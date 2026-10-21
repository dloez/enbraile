import logging
from pathlib import Path

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


class SessionLog(logging.FileHandler):
    pass


def attach_session_log(session_dir: Path) -> None:
    harness_log = logging.getLogger("harness")
    for previous in [each for each in harness_log.handlers if isinstance(each, SessionLog)]:
        harness_log.removeHandler(previous)
        previous.close()
    handler = SessionLog(session_dir / "harness.log", encoding="utf-8")
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    harness_log.addHandler(handler)
