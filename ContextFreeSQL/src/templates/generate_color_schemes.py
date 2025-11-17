"""
Generate color scheme variations for data_compare.html
Creates 3 professional color variations
"""

import re

# Read the original file
with open('data_compare.html', 'r', encoding='utf-8') as f:
    original_content = f.read()

# Define color schemes
# Current (Purple/Teal): Purple/Teal accent scheme
# Scheme 1: Blue Professional - Corporate blue tones
# Scheme 2: Green Nature - Fresh green tones
# Scheme 3: Neutral Gray - Classic gray/blue tones

color_schemes = {
    'scheme1_blue': {
        'name': 'Blue Professional',
        'description': 'Corporate blue - clean and professional',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #4e73df 0%, #224abe 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #1f3a93 0%, #2948b1 100%)',
            # Accent color (buttons, focus states)
            '#667eea': '#4e73df',
            'rgba(102, 126, 234, 0.15)': 'rgba(78, 115, 223, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(78, 115, 223, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(78, 115, 223, 0.3)',
            # Source database color
            '#6f42c1': '#1e88e5',  # Bright blue
            'rgba(111, 66, 193, 0.05)': 'rgba(30, 136, 229, 0.05)',
            # Target database color
            '#20c997': '#43a047',  # Green
            'rgba(32, 201, 151, 0.05)': 'rgba(67, 160, 71, 0.05)',
            # Status colors (keep standard)
            '#28a745': '#28a745',  # Green (equal)
            '#007bff': '#1e88e5',  # Blue (left-only)
            '#fd7e14': '#ff7043',  # Orange-red (right-only)
            '#dc3545': '#e53935',  # Red (different)
        }
    },
    'scheme4_ocean': {
        'name': 'Ocean Deep',
        'description': 'Deep ocean blues and aqua - calm and professional',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #0077be 0%, #00a8cc 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #005082 0%, #006d9e 100%)',
            # Accent color
            '#667eea': '#0096c7',
            'rgba(102, 126, 234, 0.15)': 'rgba(0, 150, 199, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(0, 150, 199, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(0, 150, 199, 0.3)',
            # Source database color
            '#6f42c1': '#0077b6',
            'rgba(111, 66, 193, 0.05)': 'rgba(0, 119, 182, 0.05)',
            # Target database color
            '#20c997': '#00b4d8',
            'rgba(32, 201, 151, 0.05)': 'rgba(0, 180, 216, 0.05)',
            # Status colors
            '#28a745': '#06d6a0',
            '#007bff': '#0096c7',
            '#fd7e14': '#ff9e00',
            '#dc3545': '#e63946',
        }
    },
    'scheme5_sunset': {
        'name': 'Warm Sunset',
        'description': 'Warm oranges and reds - energetic and bold',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #c23866 0%, #d4567a 100%)',
            # Accent color
            '#667eea': '#ff6b6b',
            'rgba(102, 126, 234, 0.15)': 'rgba(255, 107, 107, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(255, 107, 107, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(255, 107, 107, 0.3)',
            # Source database color
            '#6f42c1': '#f06543',
            'rgba(111, 66, 193, 0.05)': 'rgba(240, 101, 67, 0.05)',
            # Target database color
            '#20c997': '#fca311',
            'rgba(32, 201, 151, 0.05)': 'rgba(252, 163, 17, 0.05)',
            # Status colors
            '#28a745': '#06d6a0',
            '#007bff': '#3d5a80',
            '#fd7e14': '#ff9e00',
            '#dc3545': '#e63946',
        }
    },
    'scheme6_forest': {
        'name': 'Dark Forest',
        'description': 'Deep forest greens - rich and earthy',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #2d6a4f 0%, #40916c 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
            # Accent color
            '#667eea': '#52b788',
            'rgba(102, 126, 234, 0.15)': 'rgba(82, 183, 136, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(82, 183, 136, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(82, 183, 136, 0.3)',
            # Source database color
            '#6f42c1': '#2d6a4f',
            'rgba(111, 66, 193, 0.05)': 'rgba(45, 106, 79, 0.05)',
            # Target database color
            '#20c997': '#74c69d',
            'rgba(32, 201, 151, 0.05)': 'rgba(116, 198, 157, 0.05)',
            # Status colors
            '#28a745': '#52b788',
            '#007bff': '#40916c',
            '#fd7e14': '#f4a261',
            '#dc3545': '#e76f51',
        }
    },
    'scheme7_midnight': {
        'name': 'Midnight Blue',
        'description': 'Dark navy and indigo - sophisticated and modern',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            # Accent color
            '#667eea': '#3b82f6',
            'rgba(102, 126, 234, 0.15)': 'rgba(59, 130, 246, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(59, 130, 246, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(59, 130, 246, 0.3)',
            # Source database color
            '#6f42c1': '#6366f1',
            'rgba(111, 66, 193, 0.05)': 'rgba(99, 102, 241, 0.05)',
            # Target database color
            '#20c997': '#8b5cf6',
            'rgba(32, 201, 151, 0.05)': 'rgba(139, 92, 246, 0.05)',
            # Status colors
            '#28a745': '#10b981',
            '#007bff': '#3b82f6',
            '#fd7e14': '#f59e0b',
            '#dc3545': '#ef4444',
        }
    },
    'scheme8_monochrome': {
        'name': 'Pure Monochrome',
        'description': 'Black, white, and grays - ultra minimalist',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
            # Accent color
            '#667eea': '#6b7280',
            'rgba(102, 126, 234, 0.15)': 'rgba(107, 114, 128, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(107, 114, 128, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(107, 114, 128, 0.3)',
            # Source database color
            '#6f42c1': '#374151',
            'rgba(111, 66, 193, 0.05)': 'rgba(55, 65, 81, 0.05)',
            # Target database color
            '#20c997': '#6b7280',
            'rgba(32, 201, 151, 0.05)': 'rgba(107, 114, 128, 0.05)',
            # Status colors
            '#28a745': '#059669',
            '#007bff': '#2563eb',
            '#fd7e14': '#d97706',
            '#dc3545': '#dc2626',
        }
    },
    'scheme9_lavender': {
        'name': 'Soft Lavender',
        'description': 'Gentle purples and pinks - soft and calming',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
            # Accent color
            '#667eea': '#a78bfa',
            'rgba(102, 126, 234, 0.15)': 'rgba(167, 139, 250, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(167, 139, 250, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(167, 139, 250, 0.3)',
            # Source database color
            '#6f42c1': '#8b5cf6',
            'rgba(111, 66, 193, 0.05)': 'rgba(139, 92, 246, 0.05)',
            # Target database color
            '#20c997': '#d946ef',
            'rgba(32, 201, 151, 0.05)': 'rgba(217, 70, 239, 0.05)',
            # Status colors
            '#28a745': '#10b981',
            '#007bff': '#6366f1',
            '#fd7e14': '#f59e0b',
            '#dc3545': '#ec4899',
        }
    },
    'scheme10_earth': {
        'name': 'Earth Tones',
        'description': 'Browns and tans - warm and natural',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #78350f 0%, #92400e 100%)',
            # Accent color
            '#667eea': '#d97706',
            'rgba(102, 126, 234, 0.15)': 'rgba(217, 119, 6, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(217, 119, 6, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(217, 119, 6, 0.3)',
            # Source database color
            '#6f42c1': '#92400e',
            'rgba(111, 66, 193, 0.05)': 'rgba(146, 64, 14, 0.05)',
            # Target database color
            '#20c997': '#ca8a04',
            'rgba(32, 201, 151, 0.05)': 'rgba(202, 138, 4, 0.05)',
            # Status colors
            '#28a745': '#16a34a',
            '#007bff': '#0284c7',
            '#fd7e14': '#ea580c',
            '#dc3545': '#dc2626',
        }
    },
    'scheme2_green': {
        'name': 'Green Nature',
        'description': 'Fresh green tones - calming and natural',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #2d5016 0%, #3e6b1f 100%)',
            # Accent color (buttons, focus states)
            '#667eea': '#4caf50',
            'rgba(102, 126, 234, 0.15)': 'rgba(76, 175, 80, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(76, 175, 80, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(76, 175, 80, 0.3)',
            # Source database color
            '#6f42c1': '#00897b',  # Teal
            'rgba(111, 66, 193, 0.05)': 'rgba(0, 137, 123, 0.05)',
            # Target database color
            '#20c997': '#7cb342',  # Light green
            'rgba(32, 201, 151, 0.05)': 'rgba(124, 179, 66, 0.05)',
            # Status colors
            '#28a745': '#4caf50',  # Green (equal)
            '#007bff': '#00acc1',  # Cyan (left-only)
            '#fd7e14': '#ff9800',  # Orange (right-only)
            '#dc3545': '#f44336',  # Red (different)
        }
    },
    'scheme3_gray': {
        'name': 'Neutral Gray',
        'description': 'Classic gray and slate - minimalist and timeless',
        'colors': {
            # Body background gradient
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)': 'linear-gradient(135deg, #525252 0%, #3d5a80 100%)',
            # Header gradient
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)': 'linear-gradient(135deg, #263238 0%, #37474f 100%)',
            # Accent color (buttons, focus states)
            '#667eea': '#546e7a',
            'rgba(102, 126, 234, 0.15)': 'rgba(84, 110, 122, 0.15)',
            'rgba(102, 126, 234, 0.1)': 'rgba(84, 110, 122, 0.1)',
            'rgba(102, 126, 234, 0.3)': 'rgba(84, 110, 122, 0.3)',
            # Source database color
            '#6f42c1': '#5c6bc0',  # Indigo
            'rgba(111, 66, 193, 0.05)': 'rgba(92, 107, 192, 0.05)',
            # Target database color
            '#20c997': '#26a69a',  # Teal
            'rgba(32, 201, 151, 0.05)': 'rgba(38, 166, 154, 0.05)',
            # Status colors
            '#28a745': '#66bb6a',  # Green (equal)
            '#007bff': '#42a5f5',  # Blue (left-only)
            '#fd7e14': '#ffa726',  # Orange (right-only)
            '#dc3545': '#ef5350',  # Red (different)
        }
    }
}

def replace_colors(content, color_map):
    """Replace colors in content using the color map"""
    result = content
    # Sort by length (longest first) to avoid partial replacements
    for old_color, new_color in sorted(color_map.items(), key=lambda x: len(x[0]), reverse=True):
        result = result.replace(old_color, new_color)
    return result

# Generate each color scheme file
for scheme_id, scheme_data in color_schemes.items():
    new_content = replace_colors(original_content, scheme_data['colors'])

    # Update the title to include the scheme name
    new_content = new_content.replace(
        '<title>Table Data Comparison Report</title>',
        f'<title>Table Data Comparison Report - {scheme_data["name"]}</title>'
    )

    # Update the footer to mention the color scheme
    new_content = new_content.replace(
        'Table Data Comparison Report • Generated on',
        f'Table Data Comparison Report - {scheme_data["name"]} • Generated on'
    )

    # Write the new file
    filename = f'data_compare_{scheme_id}.html'
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f'[OK] Created {filename}: {scheme_data["description"]}')

print('\n[SUCCESS] All color scheme variations created successfully!')
print('\nFiles created:')
print('  - data_compare_scheme1_blue.html (Blue Professional)')
print('  - data_compare_scheme2_green.html (Green Nature)')
print('  - data_compare_scheme3_gray.html (Neutral Gray)')
