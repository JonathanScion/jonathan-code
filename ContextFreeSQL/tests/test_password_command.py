"""
Fetching the password instead of storing it.

Azure PostgreSQL with Microsoft Entra wants a short-lived access token as the password, so the credential
has to be fetched on every run. `az login` does not authenticate PostgreSQL, which knows nothing about
Entra - a client hit exactly that, and got 'fe_sendauth: no password supplied' repeated ten times.

These run the real function rather than a mock of it, because the parts that went wrong are the parts a
mock would paper over: a trailing newline on the token, a command that fails, and one that never returns.
"""
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import src.main as main

# Built through the running interpreter, so it behaves the same on a Windows cmd.exe shell and a POSIX one
def py(code):
    return f'"{sys.executable}" -c "{code}"'


def test_the_output_becomes_the_password():
    assert main.run_password_command(py('print(\'a-token\')')) == 'a-token'


def test_a_trailing_newline_is_stripped():
    """A password carrying a newline fails authentication with nothing on screen to explain why."""
    assert main.run_password_command(py('print(\'a-token\\n\\n\')')) == 'a-token'


def test_a_token_with_inner_punctuation_survives():
    """A JWT is three base64 parts joined by dots, and can hold - and _ too."""
    token = 'eyJ0eXAi.eyJhdWQi-x_y.SflKxwRJ'
    assert main.run_password_command(py(f'print(\'{token}\')')) == token


def test_a_command_that_fails_stops_the_run():
    with pytest.raises(SystemExit) as exit_info:
        main.run_password_command(py('import sys; sys.exit(3)'))
    assert exit_info.value.code == 1


def test_a_command_that_prints_nothing_stops_the_run():
    """Rather than connecting with an empty password and blaming the server."""
    with pytest.raises(SystemExit) as exit_info:
        main.run_password_command(py('pass'))
    assert exit_info.value.code == 1


def test_the_command_line_is_not_echoed(capsys):
    """
    Only the program name is printed.

    A command can carry a secret of its own - a vault token as an argument - and this output goes to
    terminals and CI logs.
    """
    main.run_password_command(py('print(\'tok\')') + ' ')
    printed = capsys.readouterr().out
    assert 'Fetching the password with' in printed
    assert '--token' not in printed
    assert 'print' not in printed, f'the command line was echoed: {printed}'


@pytest.mark.slow
def test_a_command_that_hangs_is_killed(monkeypatch):
    """
    The guard has to kill the whole tree, not just the shell.

    With shell=True, killing only the shell leaves a grandchild holding the pipes and the read blocks for
    ever - a guard that does not guard. Checked by timing: this returns in seconds, not in the sleep's 300.
    """
    import time
    monkeypatch.setattr(main, 'PASSWORD_COMMAND_TIMEOUT', 3)
    started = time.monotonic()
    with pytest.raises(SystemExit) as exit_info:
        main.run_password_command(py('import time; time.sleep(300)'))
    took = time.monotonic() - started
    assert exit_info.value.code == 1
    assert took < 60, f'it waited {took:.0f}s, so the timeout did not take effect'
