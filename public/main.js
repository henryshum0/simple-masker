//////////////////////////////////////////////
// Data functionality
//////////////////////////////////////////////

function load_masking_data(category, index) {
    let promise = fetch("/api/masking_data/" + category + "/" + index);
    promise.then(response => {
        if (response.status !== 200) {
            console.log('It looks like there was a problem. Status Code: ' +
                response.status);
            return;
        }

        response.json().then(data => {
            if (data.result) {
                let image = document.getElementById("mask-image");
                let container = document.getElementById("container");

                image.src = data.image;

                // Get image height/width, constrain the container
                // and draw the mask as the same size.
                let tempImage = new Image();
                tempImage.src = data.image;
                tempImage.decode().then(() => {
                    // container.style.width = tempImage.width + "px";
                    // container.style.height = tempImage.height + "px";
                    drawMask(data.mask, tempImage.height, tempImage.width);
                });
            } else {
                console.error(data.message)
            }
        }).catch(error => {
            console.log(error.message);
        })
    })
}

function drawMask(mask, height, width) {
    let mask_canvas = document.getElementById("mask-canvas");
    mask_canvas.height = height
    mask_canvas.width = width;
    canvas_height = height;
    canvas_width = width;
    let mask_ctx = mask_canvas.getContext('2d');
    if (!mask) {
        // No mask present, start with black
        mask_ctx.fillSyle = "black";
        mask_ctx.fillRect(0, 0, mask_canvas.width, mask_canvas.height);
    } else {
        let img = new Image();
        img.onload = function () {
            mask_ctx.drawImage(this, 0, 0, mask_canvas.width, mask_canvas.height);
        }
        img.src = mask;
    }
}

//////////////////////////////////////////////
// Canvas drawing functionality
//////////////////////////////////////////////

let canvas;
let ctx
let dragging = false;
let color = 'white';
let brush_width = 10;
let canvas_width = 533;
let canvas_height = 800;
let brush_spacing = 1;
let last_pos = false;
let past = [];
let future = [];
let history_size = 5;

// Utility Functions

function storeState() {
    past.push(ctx.getImageData(0, 0, canvas_width, canvas_height));
    if (past.length > history_size) {
        // Remove the first element (oldest state)
        past.shift()
    }

    if (future.length > 0) {
        // Reset future array to remove all redos
        future = [];
    }
}

function getMouseXY(e) {
    let rect = e.target.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    x = (x / rect.width) * canvas_width;
    y = (y / rect.height) * canvas_height;

    return [x, y];
}

function getTouchXY(e) {
    let touch = e.touches[0];
    let rect = e.target.getBoundingClientRect();
    let x = touch.clientX - rect.left;
    let y = touch.clientY - rect.top;

    x = (x / rect.width) * canvas_width;
    y = (y / rect.height) * canvas_height;

    return [x, y];
}

// Desktop/Laptop Handling

function paintMouseDown(e) {
    storeState();
    dragging = true;
    let [x, y] = getMouseXY(e);
    drawPoint(x, y);
    last_pos = [x, y];
}

function paintMouseUp(e) {
    dragging = false;
    last_pos = false;
}

function paintMouseMove(e) {
    
    e.preventDefault();
    e.stopPropagation();

    if (dragging) {
        let [x, y] = getMouseXY(e);
        drawPoint(x, y);
        last_pos = [x, y];
    }
}

// Mobile Handling

function paintTouchDown(e) {
    storeState();
    dragging = true;
    let [x, y] = getTouchXY(e);
    drawPoint(x, y);
    last_pos = [x, y];
}

function paintTouchUp(e) {
    dragging = false;
    last_pos = false;
}

function paintTouchMove(e) {
    e.preventDefault();
    e.stopPropagation();

    if (dragging) {
        let [x, y] = getTouchXY(e);
        drawPoint(x, y);
        last_pos = [x, y];
    }
}

// Drawing

function dist(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))
}

function drawCircle(x, y, width) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, width, 0, 2 * Math.PI);
    ctx.fill();
}

function drawPoint(x, y) {
    // Linear interpolation from last point
    if (last_pos) {
        let [x0, y0] = last_pos;
        let d = dist(x0, y0, x, y);
        if (d > brush_spacing) {
            let spacing_ratio = brush_spacing / d;
            let spacing_ratio_total = spacing_ratio;
            while (spacing_ratio_total <= 1) {
                let xn = x0 + spacing_ratio_total * (x - x0);
                let yn = y0 + spacing_ratio_total * (y - y0);

                // Draw at the interpolated point
                drawCircle(xn, yn, brush_width);

                spacing_ratio_total += spacing_ratio;
            }
        } else {
            drawCircle(x, y, brush_width);
        }
    } else {
        drawCircle(x, y, brush_width);
    }
}

// Setup

function setupCanvas() {
    canvas = document.getElementById("mask-canvas");
    ctx = canvas.getContext('2d');

    // Keyboard shortcuts
    document.addEventListener('keyup', keyboardShortcuts);

    canvas.addEventListener('mousedown', paintMouseDown);
    canvas.addEventListener('mousemove', paintMouseMove);
    canvas.addEventListener('mouseup', paintMouseUp);

    canvas.addEventListener('touchstart', paintTouchDown);
    canvas.addEventListener('touchmove', paintTouchMove);
    canvas.addEventListener('touchend', paintTouchUp);
}

//////////////////////////////////////////////
// UI functionality
//////////////////////////////////////////////

let uiHidden = false;

function hideUI() {
    uiHidden = !uiHidden;
    const ids = ["control-save", "control-switch", "control-size1", "control-size2",
        "control-size3", "next-button", "back-button", "control-toggle-mask",
        "control-undo", "control-redo"];
    for (const elm_id of ids) {
        let elm = document.getElementById(elm_id);
        if (uiHidden) {
            elm.style.visibility = "hidden";
        } else {
            elm.style.visibility = "visible";
        }
    }

    let hide = document.getElementById("control-hide")
    if (uiHidden) {
        hide.innerHTML = "Unhide";
    } else {
        hide.innerHTML = "Hide";
    }
}

function toggleMask() {
    let mask_canvas = document.getElementById("mask-canvas");
    mask_canvas.classList.toggle("hidden");
}

function switchColor() {
    let control_switch = document.getElementById("control-switch");
    if (color === "white") {
        color = "black";
        control_switch.innerHTML = "⚫️ Black";
    } else {
        color = "white";
        control_switch.innerHTML = "⚪️ White";
    }
}

function changeBrushSize(size) {
    brush_width = size;
}

function undo() {
    if (past.length > 0) {
        // Save the current state for redo
        current_state = ctx.getImageData(0, 0, canvas_width, canvas_height);
        future.push(current_state);
        // Reload the past state
        past_state = past.pop()
        ctx.putImageData(past_state, 0, 0);
    }
}

function redo() {
    if (future.length > 0) {
        // Save the current state for undo
        current_state = ctx.getImageData(0, 0, canvas_width, canvas_height);
        past.push(current_state);
        // Reload the past state
        state = future.pop()
        ctx.putImageData(state, 0, 0);
    }
}

function saveMask(category, index) {
    let save = document.getElementById("control-save");
    save.innerHTML = "Saving...";

    let promise = fetch("/api/save_mask/" + category + '/' + index, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 'mask': canvas.toDataURL() })
    });
    promise.then(response => {
        if (response.status !== 200) {
            console.log('Looks like there was a problem. Status Code: ' +
                response.status);
            return;
        }

        response.json().then(data => {
            if (data.result) {
                save.innerHTML = "✅ Success";
            } else {
                save.innerHTML = "❌ Error";
            }

            setTimeout(function () {
                save.innerHTML = "💾 Save";
            }, 3000);
        }).catch(error => {
            console.log(error.message);
        })
    })
}

function keyboardShortcuts(e) {
    // Undo
    if (e.ctrlKey && e.key === 'z') {
        undo();
    }
    // Brush sizes
    if (e.key === '1') {
        changeBrushSize(3);
    } else if (e.key === '2') {
        changeBrushSize(10);
    } else if (e.key === '3') {
        changeBrushSize(20);
    }
    else if (e.key === 'w')
    {
        window.scrollBy(0, -100);
    }
    else if (e.key === 's')
    {
        window.scrollBy(0, 100);
    }
    else if (e.key === 'a'
    )
    {
        window.scrollBy(-100, 0);
    }
    else if (e.key === 'd') {
        window.scrollBy(100, 0);
    }
    // Switch color
    else if (e.key === 'c') {
        switchColor();
    }
    // Toggle mask visibility
    else if (e.key === 'm') {
        toggleMask();
    }
    // Hide UI
    else if (e.key === 'h') {
        hideUI();
    }
}

function fixUIScale() {
    const container = document.getElementById('paint-controls');
    const back_btn = document.getElementById('back-button');
    const next_btn = document.getElementById('next-button');
    const scale = 1 / window.devicePixelRatio;
    if (container) {

        container.style.transform = `scale(${scale})`;
    }
    if (back_btn) {
        back_btn.style.transform = `scale(${scale})`;
    }
    if (next_btn) {
        next_btn.style.transform = `scale(${scale})`;
    }

}
window.addEventListener('resize', fixUIScale);
window.addEventListener('DOMContentLoaded', fixUIScale);