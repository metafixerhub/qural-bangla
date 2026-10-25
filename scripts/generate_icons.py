import os
from PIL import Image, ImageOps, ImageDraw

def generate_all_icons():
    src_path = "image (2).png"
    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source image not found: {src_path}")
    
    src_img = Image.open(src_path).convert("RGBA")
    print(f"Loaded source image {src_path} with size {src_img.size}")

    # 1. Web icons in public/icons
    os.makedirs("public/icons", exist_ok=True)
    src_img.save("public/icons/icon.png", format="PNG")
    src_img.resize((512, 512), Image.Resampling.LANCZOS).save("public/icons/icon-512.png", format="PNG")
    src_img.resize((192, 192), Image.Resampling.LANCZOS).save("public/icons/icon-192.png", format="PNG")
    src_img.resize((64, 64), Image.Resampling.LANCZOS).save("public/icons/favicon-64.png", format="PNG")
    src_img.resize((32, 32), Image.Resampling.LANCZOS).save("public/icons/favicon-32.png", format="PNG")
    print("Generated web icons in public/icons/")

    # 2. Android mipmap icons
    mipmap_configs = {
        "mipmap-mdpi": (48, 108),
        "mipmap-hdpi": (72, 162),
        "mipmap-xhdpi": (96, 216),
        "mipmap-xxhdpi": (144, 324),
        "mipmap-xxxhdpi": (192, 432),
    }

    # Extract dominant deep green background color from corner of icon
    # Top-left or center background
    bg_color = (3, 33, 26, 255) # #03211a

    for folder, (launcher_size, fg_size) in mipmap_configs.items():
        dir_path = os.path.join("android", "app", "src", "main", "res", folder)
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)

        # A) Standard square/squircle launcher icon
        launcher_img = src_img.resize((launcher_size, launcher_size), Image.Resampling.LANCZOS)
        launcher_path = os.path.join(dir_path, "ic_launcher.png")
        launcher_img.save(launcher_path, format="PNG")

        # B) Circular launcher icon (ic_launcher_round.png)
        # Create a circle mask
        mask = Image.new("L", (launcher_size, launcher_size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, launcher_size, launcher_size), fill=255)
        round_img = Image.new("RGBA", (launcher_size, launcher_size), (0, 0, 0, 0))
        round_img.paste(launcher_img, (0, 0), mask=mask)
        round_path = os.path.join(dir_path, "ic_launcher_round.png")
        round_img.save(round_path, format="PNG")

        # C) Foreground adaptive icon (ic_launcher_foreground.png)
        # Android adaptive foreground is 108dp, inner safe zone is 72dp (~66.6% size)
        # We scale icon to ~72% of the fg size and center it with transparent or clean background
        inner_size = int(fg_size * 0.76)
        scaled_icon = src_img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
        offset = (fg_size - inner_size) // 2
        
        fg_img = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
        fg_img.paste(scaled_icon, (offset, offset), mask=scaled_icon)
        fg_path = os.path.join(dir_path, "ic_launcher_foreground.png")
        fg_img.save(fg_path, format="PNG")

        print(f"Updated {folder}: launcher={launcher_size}px, round={launcher_size}px, fg={fg_size}px")

    # Update ic_launcher_background.xml
    bg_xml_path = os.path.join("android", "app", "src", "main", "res", "values", "ic_launcher_background.xml")
    if os.path.exists(bg_xml_path):
        with open(bg_xml_path, "w", encoding="utf-8") as f:
            f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#03211A</color>\n</resources>\n')
        print("Updated ic_launcher_background.xml to #03211A")

    print("All app icons generated successfully!")

if __name__ == "__main__":
    generate_all_icons()
