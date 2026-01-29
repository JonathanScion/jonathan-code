import zipfile
import os

# === BACKEND ZIP ===
backend_zip = 'hostinger-backend.zip'
source_dir = 'hostinger-deploy'

if os.path.exists(backend_zip):
    os.remove(backend_zip)

files_to_include = [
    'server.js',
    'server.bundle.mjs',
    'package.json',
    '.env',
    '.htaccess',
]

# Directories to include (with placeholder files)
dirs_to_include = ['logs', 'uploads']

with zipfile.ZipFile(backend_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for filename in files_to_include:
        file_path = os.path.join(source_dir, filename)
        if os.path.exists(file_path):
            zf.write(file_path, filename)
            print(f'Backend - Added: {filename}')
        else:
            print(f'Backend - WARNING: {filename} not found, skipping')

    for dirname in dirs_to_include:
        gitkeep = os.path.join(source_dir, dirname, '.gitkeep')
        if os.path.exists(gitkeep):
            zf.write(gitkeep, f'{dirname}/.gitkeep')
            print(f'Backend - Added: {dirname}/.gitkeep')
        else:
            # Create empty directory entry
            zf.writestr(f'{dirname}/', '')
            print(f'Backend - Added: {dirname}/ (empty dir)')

print(f'\nCreated: {backend_zip} ({os.path.getsize(backend_zip)} bytes)')

# === FRONTEND ZIP ===
frontend_zip = 'hostinger-frontend.zip'
frontend_dir = 'frontend/dist'

if os.path.exists(frontend_zip):
    os.remove(frontend_zip)

if os.path.exists(frontend_dir):
    with zipfile.ZipFile(frontend_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(frontend_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arc_name = os.path.relpath(file_path, frontend_dir)
                arc_name = arc_name.replace('\\', '/')
                zf.write(file_path, arc_name)
                print(f'Frontend - Added: {arc_name}')

    print(f'\nCreated: {frontend_zip} ({os.path.getsize(frontend_zip)} bytes)')
else:
    print(f'\nSkipped frontend zip: {frontend_dir} not found')

# === VERIFY ===
print('\n=== Backend zip contents ===')
with zipfile.ZipFile(backend_zip, 'r') as zf:
    for info in zf.infolist():
        print(f'  {info.filename} ({info.file_size} bytes)')

if os.path.exists(frontend_zip):
    print('\n=== Frontend zip contents ===')
    with zipfile.ZipFile(frontend_zip, 'r') as zf:
        for info in zf.infolist():
            print(f'  {info.filename} ({info.file_size} bytes)')
