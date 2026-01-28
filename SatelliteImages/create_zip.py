import zipfile
import os

# === BACKEND ZIP ===
backend_zip = 'hostinger-backend.zip'
source_dir = 'hostinger-deploy'

if os.path.exists(backend_zip):
    os.remove(backend_zip)

files_to_include = ['server.js', 'package.json']

with zipfile.ZipFile(backend_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for filename in files_to_include:
        file_path = os.path.join(source_dir, filename)
        if os.path.exists(file_path):
            zf.write(file_path, filename)
            print(f'Backend - Added: {filename}')

print(f'\nCreated: {backend_zip} ({os.path.getsize(backend_zip)} bytes)')

# === FRONTEND ZIP ===
frontend_zip = 'hostinger-frontend.zip'
frontend_dir = 'frontend/dist'

if os.path.exists(frontend_zip):
    os.remove(frontend_zip)

with zipfile.ZipFile(frontend_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arc_name = os.path.relpath(file_path, frontend_dir)
            arc_name = arc_name.replace('\', '/')
            zf.write(file_path, arc_name)
            print(f'Frontend - Added: {arc_name}')

print(f'\nCreated: {frontend_zip} ({os.path.getsize(frontend_zip)} bytes)')

# === VERIFY ===
print('\n=== Backend zip contents ===')
with zipfile.ZipFile(backend_zip, 'r') as zf:
    for info in zf.infolist():
        print(f'  {info.filename} ({info.file_size} bytes)')

print('\n=== Frontend zip contents ===')
with zipfile.ZipFile(frontend_zip, 'r') as zf:
    for info in zf.infolist():
        print(f'  {info.filename} ({info.file_size} bytes)')
