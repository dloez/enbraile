import json

from anil.harness.investigate import Session

EXPORT_SOURCE = "AnilJSON.encode(RandomlockeShowdown.export)"


def export_party(session: Session) -> str:
    text = session.eval(EXPORT_SOURCE).value.inspect
    return json.loads(json.loads(text.replace("\\#", "#")))
