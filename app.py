from os import listdir
from os.path import join, isfile, splitext, basename
import base64
import re
import argparse

from flask import Flask, render_template, jsonify, request


parser = argparse.ArgumentParser()
# Config
parser.add_argument('--root_data_path', default="./masking_data", type=str,
                    help="""Path to the root data folder. Must be the
                            parent folder containing category folders.
                            Defaults to ./masking_data""")
args = parser.parse_args()


# Utility Functions
def atoi(text):
    return int(text) if text.isdigit() else text


def natural_keys(text):
    return [atoi(c) for c in re.split(r'(\d+)', text)]


def get_files(path):
    files = [f for f in listdir(path) if isfile(join(path, f))]
    files.sort(key=natural_keys)  # Sorted in human order
    return files


def get_image_paths(path):
    paths = get_files(path)
    imgs = []
    for img in paths:
        if (img.endswith('.jpg') or img.endswith('.png')
                or img.endswith('.jpeg')):
            imgs.append(join(path, img))
    return imgs


def get_base64_encoded_image(image_path):
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode('utf-8')


# Flask App
app = Flask(__name__,
            static_url_path='',
            static_folder='public',
            template_folder='./public')


@app.route("/masking/<string:category>/<int:img_num>")
def img_mask(category, img_num):
    return render_template('index.html', img_num=int(img_num),
                           category=category)


@app.route("/api/masking_data/<string:category>/<int:img_num>",
           methods=['GET'])
def masking_data(category, img_num):
    imgs_root = join(args.root_data_path, f"{category}", "Images")
    img_paths = get_image_paths(imgs_root)

    if img_num > len(img_paths) - 1 or not isfile(img_paths[img_num]):
        return jsonify({'result': False, 'message': 'Image does not exist'})

    img_path = img_paths[img_num]
    print(img_path)

    img_b64 = (f'data:image/{splitext(img_path)[1]};base64,' +
               get_base64_encoded_image(img_path))

    mask_name = basename(img_path)
    mask_name = splitext(mask_name)[0] + "_mask.png"

    mask_path = join(args.root_data_path, category, "Masks",
                     mask_name)
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


@app.route("/api/save_mask/<string:category>/<int:img_num>", methods=['POST'])
def save_mask(category, img_num):
    resp = request.get_json()
    if not resp:
        return jsonify({'result': False})

    # Get all images in the category
    imgs_root = join(args.root_data_path, f"{category}", "Images")
    img_paths = get_image_paths(imgs_root)

    # Get the image at the number specified in the category
    img_path = img_paths[img_num]

    if not isfile(img_path):
        return jsonify({'result': False, 'message': 'Image does not exist'})

    # Get the file name without the extension or path
    mask_name = basename(img_path)
    mask_name = splitext(mask_name)[0] + "_mask.png"

    mask_b64 = resp['mask'].split("base64,")[1]
    mask = base64.b64decode(mask_b64)
    mask_path = join(args.root_data_path, category, "Masks",
                     mask_name)
    with open(mask_path, 'wb') as f:
        f.write(mask)

    return jsonify({'result': True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
