#!/usr/bin/env python3
"""Generate LiveClaw Studio visual assets using DALL-E 3."""

import os
import sys
import requests
from pathlib import Path
from openai import OpenAI
from PIL import Image
from io import BytesIO

API_KEY = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("OPENAI_API_KEY", "")
if not API_KEY:
    print("Usage: python generate-assets.py <openai-api-key>")
    sys.exit(1)

client = OpenAI(api_key=API_KEY)

ICONS_DIR = Path(__file__).parent.parent / "src-tauri" / "icons"
ASSETS_DIR = Path(__file__).parent.parent / "src" / "assets"
ICONS_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

STYLE_BASE = (
    "Cartoon style, clean bold outlines, flat shading, dark background (#0e0e10). "
    "The character is a cute red robot-crab mascot: square head with rounded ears/antennae, "
    "glowing cyan-white eyes, friendly smile, red crab body with pincer claws, "
    "red-orange color palette (#c0392b to #e74c3c). "
    "Style matches a modern streaming platform brand. No text in the image."
)


def generate_image(prompt: str, size: str = "1024x1024", quality: str = "standard") -> Image.Image:
    print(f"  Generating: {prompt[:80]}...")
    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size=size,
        quality=quality,
        n=1,
    )
    url = response.data[0].url
    img_bytes = requests.get(url).content
    return Image.open(BytesIO(img_bytes))


def save_resized(img: Image.Image, path: Path, size: tuple[int, int]):
    resized = img.resize(size, Image.LANCZOS)
    resized.save(str(path))
    print(f"  Saved: {path.name} ({size[0]}x{size[1]})")


def generate_ico(img: Image.Image, path: Path):
    sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
    imgs = [img.resize(s, Image.LANCZOS) for s in sizes]
    imgs[0].save(str(path), format="ICO", sizes=sizes, append_images=imgs[1:])
    print(f"  Saved: {path.name} (ICO)")


def generate_icns_placeholder(img: Image.Image, path: Path):
    """Generate a simple ICNS with a 128x128 PNG icon."""
    import struct
    buf = BytesIO()
    img.resize((128, 128), Image.LANCZOS).save(buf, format="PNG")
    png_data = buf.getvalue()
    icon_type = b"ic07"
    icon_size = len(png_data) + 8
    icns_size = icon_size + 8
    with open(str(path), "wb") as f:
        f.write(b"icns")
        f.write(struct.pack(">I", icns_size))
        f.write(icon_type)
        f.write(struct.pack(">I", icon_size))
        f.write(png_data)
    print(f"  Saved: {path.name} (ICNS)")


# ═══════════════════════════════════════════════════════
# 1. APP ICON — mascot centered, square format
# ═══════════════════════════════════════════════════════
print("\n[1/4] App Icon (mascot)")
app_icon = generate_image(
    f"A square app icon for a desktop application called 'LiveClaw Studio'. "
    f"Center the mascot on a very dark background. The mascot should be prominent and recognizable at small sizes. "
    f"{STYLE_BASE} "
    f"Icon style, centered composition, no border, suitable for 512x512 app icon.",
    size="1024x1024",
    quality="hd",
)

save_resized(app_icon, ICONS_DIR / "icon.png", (512, 512))
save_resized(app_icon, ICONS_DIR / "32x32.png", (32, 32))
save_resized(app_icon, ICONS_DIR / "128x128.png", (128, 128))
save_resized(app_icon, ICONS_DIR / "128x128@2x.png", (256, 256))
save_resized(app_icon, ICONS_DIR / "256x256.png", (256, 256))
generate_ico(app_icon, ICONS_DIR / "icon.ico")
generate_icns_placeholder(app_icon, ICONS_DIR / "icon.icns")

# ═══════════════════════════════════════════════════════
# 2. SPLASH LOGO — for BootingScreen
# ═══════════════════════════════════════════════════════
print("\n[2/4] Splash Logo")
splash = generate_image(
    f"A splash screen logo for 'LiveClaw Studio' desktop app. "
    f"The red robot-crab mascot sitting centered, looking friendly and welcoming, "
    f"with a subtle glow behind it. Very dark background (#0e0e10). "
    f"{STYLE_BASE} "
    f"Wide composition suitable for a splash screen, mascot slightly smaller with breathing room.",
    size="1792x1024",
    quality="hd",
)
splash.save(str(ASSETS_DIR / "splash.png"))
print(f"  Saved: splash.png")

# ═══════════════════════════════════════════════════════
# 3. SCENE TEMPLATE THUMBNAILS
# ═══════════════════════════════════════════════════════
print("\n[3/4] Scene Template Thumbnails")

templates = [
    ("template-fullscreen.png",
     "A minimal thumbnail icon showing a single monitor/display with a play button, representing 'Full Screen Capture'. "
     "Simple, iconic, dark background."),
    ("template-screen-webcam.png",
     "A minimal thumbnail icon showing a monitor with a small webcam circle overlay in the corner, representing 'Screen + Webcam'. "
     "Simple, iconic, dark background."),
    ("template-browser.png",
     "A minimal thumbnail icon showing a browser window with a globe icon, representing 'Browser Kiosk' mode. "
     "Simple, iconic, dark background."),
    ("template-window.png",
     "A minimal thumbnail icon showing a single application window floating, representing 'Window Capture'. "
     "Simple, iconic, dark background."),
]

for filename, desc in templates:
    img = generate_image(
        f"{desc} "
        f"Red-orange accent color (#e74c3c), dark background (#0e0e10), "
        f"clean flat design, no text, suitable as a small 256x256 thumbnail.",
        size="1024x1024",
        quality="standard",
    )
    save_resized(img, ASSETS_DIR / filename, (256, 256))

# ═══════════════════════════════════════════════════════
# 4. TRAY ICON
# ═══════════════════════════════════════════════════════
print("\n[4/4] Tray Icon")
tray = generate_image(
    f"A tiny system tray icon of the red robot-crab mascot face only (just the square head with glowing eyes). "
    f"Transparent background, extremely simple and recognizable at 16x16 pixels. "
    f"Flat design, bold shapes, no details that disappear at small size. "
    f"{STYLE_BASE}",
    size="1024x1024",
    quality="standard",
)
save_resized(tray, ASSETS_DIR / "tray-icon.png", (64, 64))
save_resized(tray, ASSETS_DIR / "tray-icon-live.png", (64, 64))  # Phase 4: swap to red-glow variant

print("\nDone! All assets generated.")
