from PIL import Image, ImageDraw, ImageFont
import os

out_dir = r"C:\Users\Priyansh\OneDrive\Desktop\crewspace\desktop-electron\assets\installer"
os.makedirs(out_dir, exist_ok=True)

# Colors
bg = (15, 15, 20)          # near-black
accent = (99, 102, 241)    # indigo
accent2 = (139, 92, 246)   # violet
text = (255, 255, 255)
text_muted = (180, 180, 190)

# NSIS 3.x header image: 493 x 58 px
header = Image.new("RGB", (493, 58), bg)
d = ImageDraw.Draw(header)

# Subtle gradient strip on left
d.rectangle([0, 0, 6, 58], fill=accent)

# Try to load a font, fallback to default
try:
    font_title = ImageFont.truetype("segoeui.ttf", 22)
    font_tag = ImageFont.truetype("segoeui.ttf", 12)
except:
    font_title = ImageFont.load_default()
    font_tag = ImageFont.load_default()

# Draw logo-ish circle
d.ellipse([24, 12, 46, 34], fill=accent, outline=accent2)
d.text((28, 16), "✦", fill=text, font=font_tag)

# Title
d.text((56, 14), "CrewSpace", fill=text, font=font_title)

# Version badge on right
badge_w = 56
badge_x = 493 - badge_w - 16
d.rounded_rectangle([badge_x, 16, badge_x + badge_w, 42], radius=4, fill=(40, 40, 50))
d.text((badge_x + 8, 20), "v0.0.2", fill=text_muted, font=font_tag)

header.save(os.path.join(out_dir, "installerHeader.bmp"))
print("Header:", header.size)

# NSIS sidebar (welcome/finish page): 164 x 314 px
sidebar = Image.new("RGB", (164, 314), bg)
d = ImageDraw.Draw(sidebar)

# Vertical accent bar
d.rectangle([0, 0, 4, 314], fill=accent)

# Top gradient decoration
for y in range(60):
    alpha = y / 60
    r = int(bg[0] + (accent[0] - bg[0]) * alpha * 0.3)
    g = int(bg[1] + (accent[1] - bg[1]) * alpha * 0.3)
    b = int(bg[2] + (accent[2] - bg[2]) * alpha * 0.3)
    d.rectangle([4, y, 164, y+1], fill=(r,g,b))

# Logo circle
d.ellipse([52, 80, 112, 140], fill=accent, outline=accent2)

# Title
d.text((24, 160), "CrewSpace", fill=text, font=font_title)
d.text((28, 190), "AI agent company", fill=text_muted, font=font_tag)
d.text((28, 206), "control plane", fill=text_muted, font=font_tag)

# Bottom tagline
d.text((20, 280), "On-premise · Private", fill=(100,100,110), font=font_tag)
d.text((20, 296), "· Secure", fill=(100,100,110), font=font_tag)

sidebar.save(os.path.join(out_dir, "installerSidebar.bmp"))
print("Sidebar:", sidebar.size)

print("Done")
