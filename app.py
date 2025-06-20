from os import listdir
from os.path import join, isfile, splitext, basename
import base64
import re
import argparse
from typing import Union

from flask import Flask, render_template, jsonify, request, redirect, url_for


parser = argparse.ArgumentParser()
# Config
parser.add_argument('--root_data_path', default="./masking_data", type=str,
                    help="""Path to the root data folder. Must be the
                            parent folder containing category folders.
                            Defaults to ./masking_data""")
args = parser.parse_args()


# Utility Functions
def atoi(text: str) -> Union[int, str]:
    """Transforms string-based integers into Python integers.
    Text that is not an integer remains as text.

    :param text: A potentially containing an integer
    :type text: str
    :return: An integer or a string
    :rtype: Union[int, str]
    """

    return int(text) if text.isdigit() else text


def natural_keys(text: str) -> list[Union[int, str]]:
    """Splits and parses zero padded, string-based integers
    so that comparison and sorting are in 'human' order.

    :param text: A string potentially containing an integer
    :type text: str
    :return: A split and integer-parsed list
    :rtype: list[Union[int, str]]
    """

    return [atoi(c) for c in re.split(r'(\d+)', text)]


def get_files(path: str) -> list[str]:
    """Retrieves a list of files from a directory sorted
    in human order.

    :param path: A string-based path to a valid directory
    :type path: str
    :return: A list of string-based file paths
    :rtype: list[str]
    """

    files = [f for f in listdir(path) if isfile(join(path, f))]
    files.sort(key=natural_keys)  # Sorted in human order
    return files


def get_image_paths(path: str) -> list[str]:
    """Retrieves a list of valid PNG or JPEG images in a
    specified directory. The paths returned are scoped at
    a level relative to the input path.

    :param path: A valid folder path
    :type path: str
    :return: A list of image file paths
    :rtype: list[str]
    """

    paths = get_files(path)
    imgs = []
    for img in paths:
        if (img.endswith('.jpg') or img.endswith('.png')
                or img.endswith('.jpeg')):
            imgs.append(join(path, img))
    return imgs


def get_base64_encoded_image(image_path: str) -> str:
    """Retrieves and encodes an image into a base64 string
    from a given path.

    :param image_path: A valid file path to an image
    :type image_path: str
    :return: A base64 encoded string
    :rtype: str
    """

    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode('utf-8')


# Flask App
app = Flask(__name__,
            static_url_path='',
            static_folder='public',
            template_folder='./public')


@app.route("/")
def index():
    # Attempt to find the first category and redirect to its first image
    categories_path = args.root_data_path
    try:
        categories = [d for d in listdir(categories_path) if not isfile(join(categories_path, d))]
        if categories:
            # Redirect to the first category and first image
            return redirect(url_for('img_mask', category=categories[0], img_num=0))
        else:
            return "No categories found in data path.", 404
    except Exception as e:
        return f"Error: {e}", 500


@app.route("/masking/<string:category>/<int:img_num>")
def img_mask(category: str, img_num: int) -> str:
    """Renders the main template for masking images.

    :param category: The masking folder category
    :type category: str
    :param img_num: The image number in the masking category
    :type img_num: int
    :return: The rendered masking template
    :rtype: str
    """

    return render_template('index.html', img_num=int(img_num),
                           category=category)


@app.route("/api/masking_data/<string:category>/<int:img_num>",
           methods=['GET'])
def masking_data(category: str, img_num: int) -> Flask.response_class:
    """An API method that responds to requests for image and mask data.
    Image/Mask pairs are returned as base64 encoded strings sent back as
    stringified JSON.
    """
    from os.path import exists

    # Construct the directory path
    imgs_root = join(args.root_data_path, f"{category}", "Images")

    # First check if the directory actually exists
    if not exists(imgs_root):
        return jsonify({
            'result': False, 
            'message': 'Image directory does not exist',
            'use_local_files': True  # Signal client to use local files
        })

    try:
        img_paths = get_image_paths(imgs_root)

        if not img_paths or img_num > len(img_paths) - 1 or not isfile(img_paths[img_num]):
            return jsonify({'result': False, 'message': 'Image does not exist'})

        img_path = img_paths[img_num]
        print(img_path)

        img_b64 = (f'data:image/{splitext(img_path)[1]};base64,' +
                get_base64_encoded_image(img_path))

        mask_name = basename(img_path)
        mask_name = splitext(mask_name)[0] + "_mask.png"

        mask_path = join(args.root_data_path, category, "Masks", mask_name)
        mask_b64 = False
        if isfile(mask_path):
            mask_b64 = ('data:image/png;base64,' +
                        get_base64_encoded_image(mask_path))

        result = {
            'result': True,
            'image': img_b64,
            'mask': mask_b64,
        }

        return jsonify(result)
    
    except Exception as e:
        return jsonify({
            'result': False, 
            'message': f'Error loading images: {str(e)}',
            'use_local_files': True  # Signal client to use local files
        })


@app.route("/api/save_mask/<string:category>/<int:img_num>", methods=['POST'])
def save_mask(category: str, img_num: int) -> Flask.response_class:
    """Receives mask data for a given category and image index as
    a Flask response. The response should be in the form of a JSON object
    containing image data as a base64 encoded string.
    """
    from os import makedirs
    from os.path import exists

    resp = request.get_json()
    if not resp:
        return jsonify({'result': False, 'message': 'No data received'})

    # Construct the directory paths
    imgs_root = join(args.root_data_path, f"{category}", "Images")
    masks_dir = join(args.root_data_path, category, "Masks")
    
    # Check if we're handling a client-side opened file (not from server directory)
    if resp.get('clientSideFile'):
        # For client-side opened files, just decode the mask and return success
        # The actual saving is handled by the client using File System Access API
        return jsonify({'result': True, 'message': 'Client-side saving handled by browser'})

    # Try to save server-side if directories exist or can be created
    try:
        # Create directories if they don't exist
        if not exists(imgs_root):
            makedirs(imgs_root)
        if not exists(masks_dir):
            makedirs(masks_dir)
            
        # Get all images in the category - only if directory exists
        if exists(imgs_root):
            img_paths = get_image_paths(imgs_root)
            
            # Check if we have enough images
            if img_num >= len(img_paths):
                return jsonify({'result': False, 'message': 'Image index out of range'})
                
            # Get the image at the number specified
            img_path = img_paths[img_num]
            
            # Generate mask name from the image
            mask_name = basename(img_path)
            mask_name = splitext(mask_name)[0] + "_mask.png"
            
        else:
            # If no server-side images exist, create a generic mask name
            mask_name = f"image_{img_num}_mask.png"
        
        # Decode and save the mask
        mask_b64 = resp['mask'].split("base64,")[1]
        mask = base64.b64decode(mask_b64)
        mask_path = join(masks_dir, mask_name)
        with open(mask_path, 'wb') as f:
            f.write(mask)
            
        return jsonify({'result': True})
        
    except Exception as e:
        return jsonify({'result': False, 'message': str(e)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
