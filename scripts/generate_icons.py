#!/usr/bin/env python3
import zlib
import struct
import os

def create_png(width, height, get_pixel):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel(x, y)
            raw_data.extend([r, g, b, a])
    
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr))
    compressed = zlib.compress(bytes(raw_data), 9)
    png.extend(chunk(b'IDAT', compressed))
    png.extend(chunk(b'IEND', b''))
    return bytes(png)

def blinky_icon_pixel(x, y, w=512, h=512):
    # Normalized coords [-1, 1]
    nx = (x / w) * 2.0 - 1.0
    ny = (y / h) * 2.0 - 1.0
    
    # Outer circle mask
    dist = (nx**2 + ny**2)**0.5
    if dist > 0.95:
        return 0, 0, 0, 0
    
    # Blinky body blob: center at (0, 0.1), radius around 0.75
    # Bottom indentation
    body_y = ny - 0.05
    body_x = nx
    
    # Base pill / marshmallow equation
    r_body = (body_x**2 + (body_y*1.08)**2)**0.5
    
    # Bottom lobes indentation
    if body_y > 0.4:
        cleft = 0.25 * ((0.5 - abs(body_x))**2)
        r_body += cleft
        
    if r_body < 0.72:
        # Inside Blinky body: pastel soft baby blue #C4E5FC
        # Radial gradient for soft 3D silicone highlight
        hl = max(0.0, 1.0 - ((body_x + 0.2)**2 + (body_y + 0.3)**2)**0.5)
        
        # Eyes: vertical ovals at x = +-0.22, y = -0.05
        eye_l = ((body_x - 0.22)**2 / (0.07**2) + (body_y + 0.05)**2 / (0.11**2))
        eye_r = ((body_x + 0.22)**2 / (0.07**2) + (body_y + 0.05)**2 / (0.11**2))
        
        if eye_l < 1.0 or eye_r < 1.0:
            return 34, 41, 51, 255 # dark charcoal eyes
            
        # Mouth: curve at y = 0.12, x between -0.15 and 0.15
        mouth_dist = abs((body_y - 0.10) - (body_x**2 * 1.5))
        if abs(body_x) < 0.12 and mouth_dist < 0.025 and (body_y - 0.10) > 0:
            return 34, 41, 51, 255 # smile
            
        # Body color with soft shading
        r = int(196 + 35 * hl)
        g = int(229 + 20 * hl)
        b = int(252)
        return min(255, r), min(255, g), min(255, b), 255
        
    return 0, 0, 0, 0

os.makedirs('src-tauri/icons', exist_ok=True)
png_512 = create_png(512, 512, lambda x, y: blinky_icon_pixel(x, y, 512, 512))
with open('src-tauri/icons/icon.png', 'wb') as f:
    f.write(png_512)

# Also generate 32x32, 128x128
png_32 = create_png(32, 32, lambda x, y: blinky_icon_pixel(x, y, 32, 32))
with open('src-tauri/icons/32x32.png', 'wb') as f:
    f.write(png_32)

png_128 = create_png(128, 128, lambda x, y: blinky_icon_pixel(x, y, 128, 128))
with open('src-tauri/icons/128x128.png', 'wb') as f:
    f.write(png_128)

with open('src-tauri/icons/128x128@2x.png', 'wb') as f:
    f.write(png_512)

# Copy icon.png for ico/icns placeholders
with open('src-tauri/icons/icon.ico', 'wb') as f:
    f.write(png_32)

with open('src-tauri/icons/icon.icns', 'wb') as f:
    f.write(png_128)

print("Icons generated successfully!")
