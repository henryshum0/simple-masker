//////////////////////////////////////////////
// Data functionality
//////////////////////////////////////////////

// First, properly initialize all file-related variables
// Add these at the very top of the file to ensure global scope
let selectedFiles = [];
let currentFileIndex = 0;
let localFileMode = false;

// Add this variable to store original filenames
let originalFilenames = {};

function load_masking_data(category, index) {
    let promise = fetch("/api/masking_data/" + category + "/" + index);
    promise.then(response => {
        if (response.status !== 200) {
            console.log('It looks like there was a problem. Status Code: ' +
                response.status);
            // Prompt for file selection on error
            promptForFileSelection();
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
                    drawMask(data.mask, tempImage.height, tempImage.width);
                });
            } else {
                console.error(data.message);
                
                // If server explicitly tells us to use local files
                if (data.use_local_files) {
                    console.log("Server suggests using local files");
                    promptForFileSelection();
                }
            }
        }).catch(error => {
            console.log(error.message);
            // Also prompt on JSON parsing error
            promptForFileSelection();
        })
    }).catch(error => {
        console.log("Network error:", error);
        // Also prompt on network error
        promptForFileSelection();
    });
}

// Simplify the prompt function to directly open files without confirmation dialogs
function promptForFileSelection() {
    // Just highlight the Open button without any alerts or auto-opening
    window.needsFileOpen = false; // Don't try to auto-open
    
    const openBtn = document.getElementById('control-open');
    if (openBtn) {
        openBtn.style.animation = 'pulse 1s infinite';
        openBtn.style.boxShadow = '0 0 10px 5px rgba(255,255,255,0.7)';
    }
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
let brush_width = 5;

let brush_spacing = 1;
let last_pos = false;
let past = [];
let future = [];
let history_size = 5;
let window_dragging = false;
let window_lastX, window_lastY;

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
    if (e.button === 0){
        storeState();
        dragging = true;
        let [x, y] = getMouseXY(e);
        drawPoint(x, y);
        last_pos = [x, y];
    }
    
}

function paintMouseUp(e) {
    if (e.button === 0){
        dragging = false;
        last_pos = false;
    }
    
}

function paintMouseMove(e) {
    if (e.button === 0) {
        e.preventDefault();
        e.stopPropagation();

        if (dragging) {
            let [x, y] = getMouseXY(e);
            drawPoint(x, y);
            last_pos = [x, y];
        }
    }
    
}

function dragWindowDown(e){
    if (e.button === 1) { // Middle mouse button
        e.preventDefault();
        document.body.style.cursor = 'grabbing';
        window_dragging = true;
        let [x, y] = [e.clientX, e.clientY];
        window_lastX = x;
        window_lastY = y;
    }
}

function dragWindowMove(e) {  
    if (window_dragging) {
        let [x, y] = [e.clientX, e.clientY];
        const dx = x - window_lastX;
        const dy = y - window_lastY;
        window.scrollBy(-dx, -dy);
        window_lastX = x;
        window_lastY = y;
    }
}

function dragWindowUp(e) {
    if (e.button === 1) {
        window_dragging = false;
        document.body.style.cursor = 'crosshair'; // Reset cursor to crosshair
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
    ctx.imageSmoothingEnabled = false;
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
let customCursor = document.getElementById('custom-cursor');
function setupCanvas() {
    canvas = document.getElementById("mask-canvas");
    // Add willReadFrequently attribute to improve getImageData performance
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    document.body.style.cursor = 'crosshair';
    display_pensize();
    updateCustomCursor();

    canvas.addEventListener('mousemove', moveCustomCursor);
    canvas.addEventListener('mouseenter', updateCustomCursor);
    canvas.addEventListener('mouseleave', hideCustomCursor);

    // Keyboard shortcuts
    document.addEventListener('keyup', keyboardShortcuts);

    canvas.addEventListener('mousedown', paintMouseDown);
    canvas.addEventListener('mousemove', paintMouseMove);
    canvas.addEventListener('mouseup', paintMouseUp);

    canvas.addEventListener('touchstart', paintTouchDown);
    canvas.addEventListener('touchmove', paintTouchMove);
    canvas.addEventListener('touchend', paintTouchUp);

    window.addEventListener('resize', fixUIScale);
    window.addEventListener('DOMContentLoaded', fixUIScale);

    canvas.addEventListener("mousedown", dragWindowDown);
    canvas.addEventListener("mousemove", dragWindowMove);
    canvas.addEventListener("mouseup", dragWindowUp);

    canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault(); // Prevent the default context menu
    let [x, y] = getMouseXY(e);
    floodFill(x, y, color);
});

    // Remove auto file opening logic
    // if (window.needsFileOpen) {
    //     setTimeout(function() {
    //         window.needsFileOpen = false;
    //         openFiles();
    //     }, 100);
    // }
}
function updateCustomCursor() {
    if (!customCursor) customCursor = document.getElementById('custom-cursor');
    customCursor.style.width = 2 * brush_width + "px";
    customCursor.style.height = 2 * brush_width + "px";
    customCursor.style.borderColor = color === "white" ? "white" : "red";
}

function hideCustomCursor() {
    if (!customCursor) customCursor = document.getElementById('custom-cursor');
    customCursor.style.display = "none";
}

function moveCustomCursor(e) {
    if (!customCursor) customCursor = document.getElementById('custom-cursor');
    customCursor.style.left = (e.clientX - brush_width ) + "px";
    customCursor.style.top = (e.clientY - brush_width ) + "px";
    customCursor.style.display = "block";
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
    updateCustomCursor();
}

function changeBrushSize(size) {
    if (brush_width + size < 1) {
        return; // Prevent brush size from going below 1
    }
    brush_width += size;
    display_pensize();
    updateCustomCursor();
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

// Check if File System Access API is supported
function isFileSystemAccessSupported() {
    return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

// Function to open files using the file picker
async function openFiles() {
    try {
        // Clear the flag
        window.needsFileOpen = false;
        
        // Set the localFileMode flag
        window.localFileMode = true;
        selectedFiles = []; // Initialize the array
        currentFileIndex = 0;
        originalFilenames = {}; // Reset original filenames
        
        if (isFileSystemAccessSupported()) {
            // Modern file picker
            const fileHandles = await window.showOpenFilePicker({
                multiple: true,
                types: [{
                    description: 'Images',
                    accept: {
                        'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
                    }
                }]
            });
            
            if (fileHandles.length > 0) {
                // Store all selected files
                for (let i = 0; i < fileHandles.length; i++) {
                    const file = await fileHandles[i].getFile();
                    selectedFiles.push({
                        name: file.name,
                        file: file
                    });
                }
                
                // Load the first image
                if (selectedFiles.length > 0) {
                    const file = selectedFiles[0].file;
                    const imageUrl = URL.createObjectURL(file);
                    
                    // Store the original filename with the blob URL as key
                    originalFilenames[imageUrl] = file.name;
                    
                    const image = document.getElementById("mask-image");
                    image.onload = function() {
                        drawMask(null, image.height, image.width);
                        // Don't revoke URL immediately or we lose reference
                        // We'll clean it up later
                        // URL.revokeObjectURL(imageUrl);
                    };
                    image.src = imageUrl;
                }
            }
        } else {
            // Fallback for browsers without File System Access API
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = function(event) {
                if (event.target.files.length > 0) {
                    const file = event.target.files[0];
                    const imageUrl = URL.createObjectURL(file);
                    const image = document.getElementById("mask-image");
                    image.onload = function() {
                        drawMask(null, image.height, image.width);
                        URL.revokeObjectURL(imageUrl);
                    };
                    image.src = imageUrl;
                }
            };
            input.click();
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            // Remove the alert and just log to console
            console.error('Error opening file:', err);
        }
    }
}

// Modify the saveMask function to indicate when we're saving a client-side file
function saveMask(category, index) {
    let save = document.getElementById("control-save");
    save.innerHTML = "Saving...";
    
    // Track if we opened the file locally
    const isClientSideFile = window.localFileMode === true;

    if (isFileSystemAccessSupported()) {
        // Use modern File System Access API
        async function saveWithFileSystem() {
            try {
                const blob = await new Promise(resolve => canvas.toBlob(resolve));

                // Get original image name with better handling
                let originalFilename = "";
                
                // Try to get filename from our stored original filenames first
                const imgElement = document.getElementById("mask-image");
                if (imgElement && imgElement.src && originalFilenames[imgElement.src]) {
                    originalFilename = originalFilenames[imgElement.src];
                }
                // If not found, fall back to selectedFiles
                else if (localFileMode && selectedFiles && selectedFiles.length > 0) {
                    try {
                        const fileIndex = Math.min(currentFileIndex, selectedFiles.length - 1);
                        if (selectedFiles[fileIndex]) {
                            originalFilename = selectedFiles[fileIndex].name;
                        }
                    } catch (err) {
                        // Silently handle errors
                    }
                }
                
                // Last resort: try to extract from image src
                if (!originalFilename) {
                    try {
                        if (imgElement && imgElement.src) {
                            // For blob URLs, this is likely to give us a UUID, not the original filename
                            const urlParts = imgElement.src.split('/');
                            if (urlParts.length) {
                                originalFilename = urlParts[urlParts.length - 1].split('?')[0];
                            }
                        }
                    } catch (err) {
                        console.warn("Error getting filename from image src:", err);
                    }
                }

                // Extract base name without extension, with fallback
                const baseName = originalFilename ? originalFilename.split('.')[0] : `mask_${Date.now()}`;
                
                // Create the file picker with the new naming format
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: `${baseName}_GT.png`,
                    types: [{
                        description: 'PNG Files',
                        accept: {'image/png': ['.png']}
                    }]
                });
                
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                
                save.innerHTML = "✅ Saved";
                setTimeout(function() {
                    save.innerHTML = "💾 Save";
                }, 3000);
                
                // If this was a client-side file, notify the server but don't try to save there
                if (isClientSideFile) {
                    fetch("/api/save_mask/" + category + '/' + index, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            'mask': canvas.toDataURL(),
                            'clientSideFile': true
                        })
                    });
                }
                
                return true;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Error saving file:', err);
                }
                // Reset the save button text on any error
                save.innerHTML = "❌ Error";
                setTimeout(function() {
                    save.innerHTML = "💾 Save";
                }, 3000);
                return false;
            }
        }
        
        saveWithFileSystem().then(success => {
            if (!success && !isClientSideFile) {
                // Only fall back to server save if this wasn't a client-side file
                saveToServer();
            }
        });
    } else {
        // Fallback to server save for browsers without File System Access API
        saveToServer();
    }
    
    function saveToServer() {
        // Existing server save code with additional parameter
        let promise = fetch("/api/save_mask/" + category + '/' + index, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                'mask': canvas.toDataURL(),
                'clientSideFile': isClientSideFile
            })
        });
        promise.then(response => {
            if (response.status !== 200) {
                console.log('Looks like there was a problem. Status Code: ' +
                    response.status);
                save.innerHTML = "❌ Error";
                return;
            }

            response.json().then(data => {
                if (data.result) {
                    save.innerHTML = "✅ Success";
                } else {
                    save.innerHTML = "❌ Error";
                }

                setTimeout(function() {
                    save.innerHTML = "💾 Save";
                }, 3000);
            }).catch(error => {
                console.log(error.message);
                save.innerHTML = "❌ Error";
                setTimeout(function() {
                    save.innerHTML = "💾 Save";
                }, 3000);
            });
        });
    }
}

function keyboardShortcuts(e) {
    // Undo
    if (e.ctrlKey && e.key === 'z') {
        undo();
    }

    if (e.ctrlKey && e.key === 'y') {
        redo();
    }
    // Save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault(); // Prevent default save dialog
        let category = document.getElementById("category").value;
        let img_num = document.getElementById("img_num").value;
        saveMask(category, img_num);
    }
    // Brush sizes
    if (e.key === '1') {
        changeBrushSize(3);
    } else if (e.key === '2') {
        changeBrushSize(10);
    } else if (e.key === '3') {
        changeBrushSize(20);
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

    else if (e.key === 'e') {
        changeBrushSize(3);
    }
    else if (e.key === 'q') {
        changeBrushSize(-3);
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

function set_cursor(e) {
    cursor.style.height = brush_width + "px";
    cursor.style.width = brush_width + "px";
    cursor.style.left = e.clientX + "px";
    cursor.style.top = e.clientY + "px";
    cursor.style.visibility = "visible";
    cursor.style.color = color
}

function display_pensize(){
    let pen_size = document.getElementById("pen-size");
    pen_size.innerHTML = "🖌 Size: " + brush_width;
}

function floodFill(x, y, fillColor, tolerance = 64) {
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Convert fillColor to RGBA array
    let fillR, fillG, fillB, fillA;
    if (fillColor === 'white') {
        [fillR, fillG, fillB, fillA] = [255, 255, 255, 255];
    } else if (fillColor === 'black') {
        [fillR, fillG, fillB, fillA] = [0, 0, 0, 255];
    } else {
        [fillR, fillG, fillB, fillA] = [255, 255, 255, 255];
    }

    // Get the starting pixel color
    const startX = Math.floor(x);
    const startY = Math.floor(y);
    const startIdx = (startY * width + startX) * 4;
    const startColor = [
        data[startIdx],
        data[startIdx + 1],
        data[startIdx + 2],
        data[startIdx + 3]
    ];

    // If the fill color is the same as the start color, do nothing
    if (
        startColor[0] === fillR &&
        startColor[1] === fillG &&
        startColor[2] === fillB &&
        startColor[3] === fillA
    ) {
        return;
    }

    // Helper to compare pixel color with tolerance
    function matchColor(idx) {
        return (
            Math.abs(data[idx] - startColor[0]) <= tolerance &&
            Math.abs(data[idx + 1] - startColor[1]) <= tolerance &&
            Math.abs(data[idx + 2] - startColor[2]) <= tolerance &&
            Math.abs(data[idx + 3] - startColor[3]) <= tolerance
        );
    }

    // Helper to set pixel color
    function setColor(idx) {
        data[idx] = fillR;
        data[idx + 1] = fillG;
        data[idx + 2] = fillB;
        data[idx + 3] = fillA;
    }

    // Optimized scanline flood fill
    const stack = [[startX, startY]];
    while (stack.length > 0) {
        let [x, y] = stack.pop();
        let idx = (y * width + x) * 4;

        // Move to the leftmost pixel in this scanline
        while (x >= 0 && matchColor(idx)) {
            x--;
            idx -= 4;
        }
        x++;
        idx += 4;

        let spanAbove = false;
        let spanBelow = false;

        // Fill rightwards and check above/below
        while (x < width && matchColor(idx)) {
            setColor(idx);

            // Check pixel above
            if (y > 0) {
                const aboveIdx = ((y - 1) * width + x) * 4;
                if (matchColor(aboveIdx)) {
                    if (!spanAbove) {
                        stack.push([x, y - 1]);
                        spanAbove = true;
                    }
                } else if (spanAbove) {
                    spanAbove = false;
                }
            }

            // Check pixel below
            if (y < height - 1) {
                const belowIdx = ((y + 1) * width + x) * 4;
                if (matchColor(belowIdx)) {
                    if (!spanBelow) {
                        stack.push([x, y + 1]);
                        spanBelow = true;
                    }
                } else if (spanBelow) {
                    spanBelow = false;
                }
            }

            x++;
            idx += 4;
        }
    }

    // Update the canvas
    ctx.putImageData(imageData, 0, 0);

    // Optional: bleed fill by 1px to cover tiny gaps
    // Comment out if not needed
    bleedFill(ctx, fillColor);
}

// Add this helper function after floodFill
function bleedFill(ctx, fillColor) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const data = imageData.data;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    let fillR, fillG, fillB, fillA;
    if (fillColor === 'white') {
        [fillR, fillG, fillB, fillA] = [255, 255, 255, 255];
    } else if (fillColor === 'black') {
        [fillR, fillG, fillB, fillA] = [0, 0, 0, 255];
    } else {
        [fillR, fillG, fillB, fillA] = [255, 255, 255, 255];
    }

    // Create a copy to check neighbors
    const copy = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            // If not filled, but has a filled neighbor, fill it
            if (
                !(data[idx] === fillR && data[idx + 1] === fillG && data[idx + 2] === fillB && data[idx + 3] === fillA)
            ) {
                // Check 8 neighbors
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nidx = ((y + dy) * width + (x + dx)) * 4;
                        if (
                            copy[nidx] === fillR &&
                            copy[nidx + 1] === fillG &&
                            copy[nidx + 2] === fillB &&
                            copy[nidx + 3] === fillA
                        ) {
                            data[idx] = fillR;
                            data[idx + 1] = fillG;
                            data[idx + 2] = fillB;
                            data[idx + 3] = fillA;
                            break;
                        }
                    }
                }
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

//flood fill functionality
