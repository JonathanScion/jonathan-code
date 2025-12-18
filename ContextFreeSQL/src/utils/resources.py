"""
Resource path utilities for PyInstaller bundled applications.

When running as a PyInstaller bundle, data files are extracted to a temp directory.
This module provides helpers to locate those files correctly.
"""
import sys
import os


def get_base_path() -> str:
    """
    Get the base path for the application.

    When running from source: returns the src directory
    When running from PyInstaller bundle: returns the temp extraction directory
    """
    if getattr(sys, 'frozen', False):
        # Running as PyInstaller bundle
        return sys._MEIPASS
    else:
        # Running from source - return the src directory
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_template_path(template_name: str) -> str:
    """
    Get the full path to a template file.

    Args:
        template_name: Name of the template file (e.g., 'db_compare_template.html')

    Returns:
        Full path to the template file
    """
    base = get_base_path()
    return os.path.join(base, 'templates', template_name)


def get_default_config_path() -> str:
    """
    Get the path to the default config.json file.

    Returns:
        Full path to config.json
    """
    base = get_base_path()
    return os.path.join(base, 'config.json')


def is_bundled() -> bool:
    """
    Check if running as a PyInstaller bundle.

    Returns:
        True if running from bundled executable, False if running from source
    """
    return getattr(sys, 'frozen', False)
