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



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
