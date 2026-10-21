import base64
import csv
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath

WINDOWS_CWD = "/mnt/c"


class InteropError(Exception):
    pass


def run_windows(*command: str) -> str:
    result = subprocess.run(
        command, cwd=WINDOWS_CWD, capture_output=True, text=True, errors="replace", check=False
    )
    if result.returncode != 0:
        raise InteropError(f"{' '.join(command)} failed: {result.stderr.strip() or result.stdout}")
    return result.stdout.replace("\r", "").strip()


def user_profile() -> PureWindowsPath:
    profile = run_windows("cmd.exe", "/c", "echo %USERPROFILE%")
    if not profile or "%" in profile:
        raise InteropError("cmd.exe did not resolve %USERPROFILE%")
    return PureWindowsPath(profile)


def to_linux(path: PureWindowsPath) -> Path:
    result = subprocess.run(
        ["wslpath", "-u", str(path)], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise InteropError(f"wslpath could not convert {path}: {result.stderr.strip()}")
    return Path(result.stdout.strip())


def to_windows(path: Path) -> PureWindowsPath:
    result = subprocess.run(
        ["wslpath", "-w", str(path)], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise InteropError(f"wslpath could not convert {path}: {result.stderr.strip()}")
    return PureWindowsPath(result.stdout.strip())


def to_unc(path: Path) -> str:
    distro = os.environ.get("WSL_DISTRO_NAME")
    if not distro:
        raise InteropError("WSL_DISTRO_NAME is not set")
    return f"\\\\wsl.localhost\\{distro}" + str(path.resolve()).replace("/", "\\")


def windows_process_image(pid: int) -> str | None:
    listing = run_windows("tasklist.exe", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH")
    for row in csv.reader(listing.splitlines()):
        if len(row) > 1 and row[1] == str(pid):
            return row[0]
    return None


def kill_windows_process(pid: int) -> None:
    run_windows("taskkill.exe", "/PID", str(pid), "/F")


def run_powershell(script: str) -> str:
    prelude = (
        "$ProgressPreference = 'SilentlyContinue'; "
        "[Console]::OutputEncoding = [Text.Encoding]::UTF8; "
    )
    encoded = base64.b64encode((prelude + script).encode("utf-16-le")).decode("ascii")
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
        cwd=WINDOWS_CWD,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        raise InteropError(f"powershell.exe failed: {result.stderr.strip() or result.stdout}")
    return result.stdout.replace("\r", "").strip()


def windows_processes_named(image: str) -> list[tuple[int, PureWindowsPath | None]]:
    listing = run_powershell(
        f"Get-CimInstance Win32_Process -Filter \"Name = '{image}'\" | "
        'ForEach-Object { "$($_.ProcessId)`t$($_.ExecutablePath)" }'
    )
    processes: list[tuple[int, PureWindowsPath | None]] = []
    for line in listing.splitlines():
        pid, _, executable = line.partition("\t")
        if not pid.isdigit():
            continue
        processes.append((int(pid), PureWindowsPath(executable) if executable else None))
    return processes


GAME_WINDOW_CLASS = "SDL_app"
SW_HIDE = 0
SW_SHOWNA = 8
NO_SHOW = -1
WIN32_TYPE = r"""
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
namespace Anil {
public static class Win {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  delegate bool MonitorProc(IntPtr m, IntPtr dc, IntPtr r, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct MonitorInfo {
    public int Size; public Rect Bounds; public Rect Work; public uint Flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Device; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct StartupInfo {
    public int Size; public string Reserved; public string Desktop; public string Title;
    public int X, Y, XSize, YSize, XChars, YChars, Fill, Flags; public short Show, Reserved2Size;
    public IntPtr Reserved2, Input, Output, Error; }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process, Thread; public int Pid, Tid; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr dc, IntPtr clip, MonitorProc p, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr m, ref MonitorInfo i);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out Rect r);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from, uint to, bool attach);
  [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, bool inherit,
    uint flags, IntPtr env, string cwd, ref StartupInfo si, out ProcessInfo pi);
  const int StartfUseShowWindow = 1;
  const uint SwpNoSize = 0x1, SwpNoZOrder = 0x4, SwpNoActivate = 0x10;
  const uint MonitorPrimary = 1;
  static readonly IntPtr PerMonitorAwareV2 = new IntPtr(-4);

  public static string Launch(string exe, string cwd, int show) {
    IntPtr foreground = GetForegroundWindow();
    StartupInfo si = new StartupInfo();
    si.Size = Marshal.SizeOf(si);
    si.Flags = StartfUseShowWindow;
    si.Show = (short)show;
    ProcessInfo pi;
    if (!CreateProcess(exe, new StringBuilder("\"" + exe + "\""), IntPtr.Zero, IntPtr.Zero, false, 0,
        IntPtr.Zero, cwd, ref si, out pi)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    CloseHandle(pi.Thread);
    CloseHandle(pi.Process);
    return pi.Pid + "\t" + foreground.ToInt64();
  }

  public static List<IntPtr> Find(uint pid, string cls) {
    List<IntPtr> found = new List<IntPtr>();
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      uint owner;
      GetWindowThreadProcessId(h, out owner);
      if (owner == pid) {
        StringBuilder name = new StringBuilder(64);
        GetClassName(h, name, 64);
        if (name.ToString() == cls) { found.Add(h); }
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  public static string Visibility(uint pid, string cls, int show) {
    StringBuilder lines = new StringBuilder();
    foreach (IntPtr h in Find(pid, cls)) {
      if (show >= 0) { ShowWindow(h, show); }
      lines.Append(h.ToInt64() + "\t" + IsWindowVisible(h) + "\n");
    }
    return lines.ToString();
  }

  public static string Place(uint pid, string cls, long previous, int show) {
    SetProcessDpiAwarenessContext(PerMonitorAwareV2);
    List<IntPtr> found = Find(pid, cls);
    if (found.Count != 1) { return "windows\t" + found.Count; }
    IntPtr h = found[0];
    MonitorInfo target = new MonitorInfo();
    bool chosen = false;
    long best = -1;
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, delegate (IntPtr m, IntPtr dc, IntPtr r, IntPtr l) {
      MonitorInfo info = new MonitorInfo();
      info.Size = Marshal.SizeOf(info);
      GetMonitorInfo(m, ref info);
      long area = (long)(info.Work.Right - info.Work.Left) * (info.Work.Bottom - info.Work.Top);
      if ((info.Flags & MonitorPrimary) == 0 && area > best) { best = area; target = info; chosen = true; }
      return true;
    }, IntPtr.Zero);
    Rect rect;
    GetWindowRect(h, out rect);
    if (chosen) {
      int width = rect.Right - rect.Left, height = rect.Bottom - rect.Top;
      int x = target.Work.Left + Math.Max(0, (target.Work.Right - target.Work.Left - width) / 2);
      int y = target.Work.Top + Math.Max(0, (target.Work.Bottom - target.Work.Top - height) / 2);
      SetWindowPos(h, IntPtr.Zero, x, y, 0, 0, SwpNoSize | SwpNoZOrder | SwpNoActivate);
      GetWindowRect(h, out rect);
    }
    if (show >= 0) { ShowWindow(h, show); }
    bool taken = GetForegroundWindow() == h;
    bool restored = taken && Restore(new IntPtr(previous), h);
    return "windows\t1\nvisible\t" + IsWindowVisible(h) + "\nmonitor\t" + (chosen ? target.Device : "")
      + "\nrect\t" + rect.Left + "," + rect.Top + "," + rect.Right + "," + rect.Bottom
      + "\ntaken\t" + taken + "\nrestored\t" + restored + "\nforeground\t" + GetForegroundWindow().ToInt64();
  }

  static bool Restore(IntPtr previous, IntPtr holder) {
    if (previous == IntPtr.Zero || !IsWindow(previous)) { return false; }
    if (SetForegroundWindow(previous) && GetForegroundWindow() == previous) { return true; }
    uint owner;
    uint holderThread = GetWindowThreadProcessId(holder, out owner);
    uint me = GetCurrentThreadId();
    AttachThreadInput(me, holderThread, true);
    SetForegroundWindow(previous);
    AttachThreadInput(me, holderThread, false);
    return GetForegroundWindow() == previous;
  }
}
}
"""


@dataclass(frozen=True)
class GameStart:
    pid: int
    foreground: int


@dataclass(frozen=True)
class WindowPlacement:
    visible: bool
    monitor: str | None
    rect: tuple[int, int, int, int]
    taken: bool
    restored: bool


def ps_string(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def run_win32(call: str) -> str:
    return run_powershell(f"Add-Type -TypeDefinition {ps_string(WIN32_TYPE)}; [Anil.Win]::{call}")


def launch_game(exe: PureWindowsPath) -> GameStart:
    output = run_win32(f"Launch({ps_string(str(exe))}, {ps_string(str(exe.parent))}, {SW_HIDE})")
    pid, _, foreground = output.splitlines()[-1].partition("\t")
    if not pid.isdigit() or not foreground.lstrip("-").isdigit():
        raise InteropError(f"unexpected launch output: {output!r}")
    return GameStart(pid=int(pid), foreground=int(foreground))


def place_game_window(pid: int, foreground: int, shown: bool) -> WindowPlacement:
    show = SW_SHOWNA if shown else SW_HIDE
    output = run_win32(f"Place({pid}, '{GAME_WINDOW_CLASS}', {foreground}, {show})")
    fields = dict(line.split("\t", 1) for line in output.splitlines() if "\t" in line)
    if fields.get("windows") != "1":
        raise InteropError(
            f"expected one {GAME_WINDOW_CLASS} window for game pid {pid}, "
            f"found {fields.get('windows')}"
        )
    left, top, right, bottom = (int(value) for value in fields["rect"].split(","))
    return WindowPlacement(
        visible=fields["visible"] == "True",
        monitor=fields["monitor"] or None,
        rect=(left, top, right, bottom),
        taken=fields["taken"] == "True",
        restored=fields["restored"] == "True",
    )


def game_window(pid: int, show: int = NO_SHOW) -> bool:
    output = run_win32(f"Visibility({pid}, '{GAME_WINDOW_CLASS}', {show})")
    windows = [line.split("\t") for line in output.splitlines() if "\t" in line]
    if len(windows) != 1:
        raise InteropError(
            f"expected one {GAME_WINDOW_CLASS} window for game pid {pid}, found {len(windows)}"
        )
    return windows[0][1] == "True"


def game_window_shown(pid: int) -> bool:
    return game_window(pid)


def show_game_window(pid: int, shown: bool) -> bool:
    return game_window(pid, SW_SHOWNA if shown else SW_HIDE)
