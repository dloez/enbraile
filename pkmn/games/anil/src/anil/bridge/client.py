import itertools
import json
import socket
import time
from typing import Any, Self

from anil.bridge.protocol import PROTOCOL_VERSION, Handshake, Reply, Role

HOST = "127.0.0.1"
CONNECT_RETRY_SECONDS = 0.5
REPLY_TIMEOUT_SECONDS = 30.0


class BridgeError(Exception):
    pass


class BridgeClient:
    def __init__(self, sock: socket.socket, name: str) -> None:
        self._sock = sock
        self._reader = sock.makefile("rb")
        self._ids = itertools.count(1)
        self.name = name

    @classmethod
    def connect(cls, port: int, *, name: str, timeout: float) -> Self:
        deadline = time.monotonic() + timeout
        while True:
            try:
                sock = socket.create_connection((HOST, port), timeout=REPLY_TIMEOUT_SECONDS)
            except OSError as error:
                if time.monotonic() >= deadline:
                    raise BridgeError(f"no bridge on {HOST}:{port} after {timeout:.0f} s: {error}")
                time.sleep(CONNECT_RETRY_SECONDS)
                continue
            return cls(sock, name)

    def request(self, cmd: str, **args: Any) -> Reply:
        request_id = next(self._ids)
        line = json.dumps({"id": request_id, "cmd": cmd, **args}, ensure_ascii=False) + "\n"
        self._sock.sendall(line.encode())
        raw = self._reader.readline()
        if not raw:
            raise BridgeError(f"bridge closed the connection during {cmd}")
        reply = Reply.model_validate(json.loads(raw))
        if reply.id != request_id:
            raise BridgeError(f"reply id {reply.id} does not match request id {request_id}")
        return reply

    def hello(self, role: Role | None = None) -> Handshake:
        args = {"client": self.name} if role is None else {"client": self.name, "role": role}
        reply = self.request("hello", **args)
        if not reply.ok:
            raise BridgeError(f"handshake refused: {reply.error}")
        handshake = Handshake.model_validate(reply.result)
        if handshake.protocol != PROTOCOL_VERSION:
            raise BridgeError(
                f"bridge speaks protocol {handshake.protocol}, client {PROTOCOL_VERSION}"
            )
        return handshake

    def wait_without_timeout(self) -> None:
        self._sock.settimeout(None)

    def close(self) -> None:
        self._reader.close()
        self._sock.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
