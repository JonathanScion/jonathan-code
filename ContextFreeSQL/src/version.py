"""The single place the version is set. Bump it when building a release.

Used by:
- `contextfreesql --version` (src/main.py)
- pyproject.toml (dynamic version)
- the generated SQL script's header comment
- the footer of the HTML report and table pages

Versioning: MAJOR.MINOR.PATCH - MINOR for new features, PATCH for fixes only.
"""

__version__ = '0.5.3'
