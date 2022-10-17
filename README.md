<h1 align="center">
  Simple Masker
  <br>
</h1>

<h4 align="center">A web utility for creating, editing, and saving binary masks for images.</h4>

![screenshot](https://raw.githubusercontent.com/Brikwerk/simple-masker/master/imgs/header.png)

## Features

- Edit masks on any device local to your network.
- Mask creation and editing works with mouse, touch, or pen-input devices.
- Relatively simple setup and mask management.

## Prerequisites

- Git must be installed.
- Python 3.6+ installed on your system.
- An accompanying Pip installation.
- Python, Git, and Pip must be accessible from the command line interface on your machine.

## Installation

1. Clone the repository onto your local machine in a convenient location.

```bash
git clone https://github.com/brikwerk/simple-masker
```

2. Change your command line interface's current working directory to the repository root and install the pip requirements.

```bash
cd simple-masker
pip install -r requirements.txt
```

## Getting Started

1. Create a new category folder in the `masking_data` folder located at the repository root. There should already be an example `test` folder created.

2. Within your newly created category folder, create an `Images` folder and a `Masks` folder.

3. Put all the images you wish to create masks for into the `Images` folder. Simple Masker accepts JPEG and PNG images.

    If you wish to add already created masks, please ensure all masks are PNG images. Additionally, please ensure that a mask has the same name as its matching image with `_mask` added. An example would be `image.jpg` and its matching mask, `image_mask.png`.

4. On the command line (with the current working directory as the repository root), run the following to start simple masker:

```bash
python app.py
```

5. You should now be able to navigate to the Simple Masker webpage in any browser. By default, you should be able to access it on your local machine (http://localhost:8000).

    To access your category and begin creating masks, add the category and the image number you wish to start on. An example for accessing a new category `fish` on your local machine would be: `http://localhost:8000/masking/fish/0`

## Using Simple Masker

Simple Masker allows you to draw in every colour, as long as its black or white. The following functions are available:

- The UI can be hidden or shown by clicking the "Hide UI" or "Show UI" button in the sidebar.
- The current mask can be toggled by clicking the "Toggle Mask" button in the sidebar.
- To save the mask currently displayed, click the "Save" button in the sidebar.
- Switching the colour can be accomplished but pushing the `White` or `Black` button in the sidebar.
- The size of the brush can be changed by clicking on one of the size buttons in the sidebar or pressing 1, 2, or 3 on your keyboard.
- 5 changes can be undone during masking by pressing the "Undo" button in the sidebar. Ctrl + Z functions as a keyboard shortcut for this as well.
- 5 redos are also available by pressing the "Redo" button in the sidebar as well.
- To flip to the next or previous image, click the "Back" or "Next" button located at the bottom left or bottom right, respectively.
