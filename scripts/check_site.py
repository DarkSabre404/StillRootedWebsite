#!/usr/bin/env python3
"""Check local page references, basic accessibility, CSS structure, and JS syntax."""

import argparse
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
STRUCTURAL_ELEMENTS = {
    "html", "head", "body", "header", "nav", "main", "section", "article",
    "aside", "footer", "div", "form", "label", "button", "select", "textarea",
    "fieldset", "legend", "details", "summary", "dialog", "ul", "ol",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "h1", "h2",
    "h3", "h4", "h5", "h6", "script", "style",
}


class PageParser(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids = set()
        self.references = []
        self.controls = []
        self.labels = set()
        self.inline_scripts = []
        self.inline_styles = []
        self._label_depth = 0
        self._button_stack = []
        self._active_script = None
        self._active_style = None
        self._structure_stack = []

    def handle_starttag(self, tag, raw_attrs):
        attrs = dict(raw_attrs)
        if tag in STRUCTURAL_ELEMENTS:
            self._structure_stack.append(tag)
        if attrs.get("id"):
            identifier = attrs["id"]
            if identifier in self.ids:
                report(f"{self.path}: duplicate id '{identifier}'")
            self.ids.add(identifier)

        if tag == "label" and attrs.get("for"):
            self.labels.add(attrs["for"])
        if tag == "label":
            self._label_depth += 1

        if tag in ("input", "select", "textarea"):
            input_type = attrs.get("type", "").lower()
            if input_type not in ("hidden", "submit", "button", "reset"):
                self.controls.append((
                    attrs.get("id"),
                    attrs.get("aria-label"),
                    attrs.get("aria-labelledby"),
                    self._label_depth > 0,
                ))

        if tag in ("a", "link"):
            href = attrs.get("href")
            if href and not (tag == "link" and "stylesheet" not in attrs.get("rel", "")):
                self.references.append((href, "href"))
        for attr in ("src", "poster"):
            if attrs.get(attr):
                self.references.append((attrs[attr], attr))
        if attrs.get("srcset"):
            for candidate in attrs["srcset"].split(","):
                src = candidate.strip().split()
                if src:
                    self.references.append((src[0], "srcset"))

        if tag == "img" and "alt" not in attrs:
            report(f"{self.path}: image is missing an alt attribute")

        if tag == "button":
            self._button_stack.append({
                "has_name": bool(attrs.get("aria-label") or attrs.get("title") or attrs.get("aria-labelledby")),
                "text": [],
            })
        if tag == "script" and not attrs.get("src"):
            script_type = attrs.get("type", "").split(";")[0].strip().lower()
            if script_type in ("", "text/javascript", "application/javascript", "module"):
                self._active_script = {"type": script_type, "text": []}
        if tag == "style":
            self._active_style = []

    def handle_endtag(self, tag):
        if tag in STRUCTURAL_ELEMENTS:
            if tag not in self._structure_stack:
                report(f"{self.path}: unexpected closing </{tag}>")
            elif self._structure_stack[-1] != tag:
                report(f"{self.path}: expected </{self._structure_stack[-1]}> before </{tag}>")
                self._structure_stack.remove(tag)
            else:
                self._structure_stack.pop()
        if tag == "label" and self._label_depth:
            self._label_depth -= 1
        if tag == "button" and self._button_stack:
            button = self._button_stack.pop()
            if not button["has_name"] and not "".join(button["text"]).strip():
                report(f"{self.path}: button has no accessible name")
        if tag == "script" and self._active_script is not None:
            script = "".join(self._active_script["text"])
            if script.strip():
                self.inline_scripts.append((self._active_script["type"], script))
            self._active_script = None
        if tag == "style" and self._active_style is not None:
            self.inline_styles.append("".join(self._active_style))
            self._active_style = None

    def handle_data(self, data):
        if self._button_stack:
            self._button_stack[-1]["text"].append(data)
        if self._active_script is not None:
            self._active_script["text"].append(data)
        if self._active_style is not None:
            self._active_style.append(data)


errors = []


def report(message):
    errors.append(message)


def local_target(source, raw_url):
    raw_url = raw_url.strip()
    if not raw_url or raw_url.startswith("#"):
        return None, urlsplit(raw_url).fragment
    parsed = urlsplit(raw_url)
    if parsed.scheme or parsed.netloc:
        return None, ""
    path = unquote(parsed.path)
    if not path:
        target = source
    elif path.startswith("/"):
        target = ROOT / path.lstrip("/")
    else:
        target = source.parent / path
    return target.resolve(), unquote(parsed.fragment)


def check_reference(source, raw_url, kind, pages):
    if raw_url.startswith(("data:", "javascript:", "mailto:", "tel:")):
        return
    target, fragment = local_target(source, raw_url)
    if target is None:
        if fragment and source.suffix.lower() == ".html":
            ids = pages.get(source.resolve(), set())
            if fragment not in ids:
                report(f"{source.relative_to(ROOT)}: missing fragment '#{fragment}'")
        return
    if not target.is_file():
        report(f"{source.relative_to(ROOT)}: missing {kind} target '{raw_url}'")
        return
    if fragment and target.suffix.lower() == ".html":
        ids = pages.get(target, set())
        if fragment not in ids:
            report(f"{source.relative_to(ROOT)}: missing fragment '{raw_url}'")


def check_css_content(content, path):
    without_comments = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)
    string_pattern = r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\""
    without_strings = re.sub(string_pattern, " ", without_comments)
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in without_strings:
        if char in "([{":
            stack.append(char)
        elif char in ")]}":
            if not stack or stack.pop() != pairs[char]:
                report(f"{path.relative_to(ROOT)}: unmatched CSS delimiter '{char}'")
                return
    if stack:
        report(f"{path.relative_to(ROOT)}: unmatched CSS delimiter '{stack[-1]}'")

    for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", without_comments, re.IGNORECASE):
        url = match.group(2).strip()
        if url.startswith(("data:", "http:", "https:", "#", "//")):
            continue
        check_reference(path, url, "CSS asset", {})


def check_css(path):
    check_css_content(path.read_text(encoding="utf-8"), path)


def check_javascript(node, pages, require_node):
    js_files = sorted(list((ROOT / "js").rglob("*.js")) + list((ROOT / "functions").rglob("*.js")))
    if not node:
        if require_node:
            report("Node.js is required for JavaScript syntax checks.")
        else:
            print("Node.js not found; JavaScript syntax checks will run in CI.")
        return

    def run_check(source, module=False, label="JavaScript"):
        command = [node, "--check"]
        if module:
            command.extend(["--input-type=module"])
        result = subprocess.run(command, input=source, text=True, capture_output=True)
        if result.returncode:
            report(f"{label}: {result.stderr.strip() or result.stdout.strip()}")

    for path in js_files:
        source = path.read_text(encoding="utf-8")
        run_check(
            source,
            module=path.name == "secure-action.js",
            label=str(path.relative_to(ROOT)),
        )

    for path, page in pages.items():
        for index, (script_type, source) in enumerate(page.inline_scripts, start=1):
            run_check(
                source,
                module=script_type == "module",
                label=f"{path.relative_to(ROOT)} inline script {index}",
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-node", action="store_true")
    args = parser.parse_args()

    html_files = sorted(ROOT.rglob("*.html"))
    html_files = [path for path in html_files if ".git" not in path.parts and ".venv" not in path.parts]
    pages = {}
    parsers = {}
    for path in html_files:
        page = PageParser(path)
        try:
            page.feed(path.read_text(encoding="utf-8"))
            page.close()
        except Exception as error:
            report(f"{path.relative_to(ROOT)}: HTML parsing failed: {error}")
        if page._structure_stack:
            report(f"{path.relative_to(ROOT)}: unclosed <{page._structure_stack[-1]}> element")
        pages[path.resolve()] = page.ids
        parsers[path.resolve()] = page
        for identifier, aria_label, labelled_by, wrapped in page.controls:
            labels_exist = bool(identifier and identifier in page.labels) or wrapped
            aria_ids = (labelled_by or "").split()
            aria_exists = bool(aria_label or any(item in page.ids for item in aria_ids))
            if not labels_exist and not aria_exists:
                report(f"{path.relative_to(ROOT)}: form control '{identifier or '(no id)'}' has no label")

    for path, page in parsers.items():
        for raw_url, kind in page.references:
            check_reference(path, raw_url, kind, pages)
        for style in page.inline_styles:
            check_css_content(style, path)

    for path in sorted((ROOT / "css").rglob("*.css")):
        check_css(path)

    check_javascript(shutil.which("node"), parsers, args.require_node)
    if errors:
        print("\n".join("ERROR: " + error for error in errors))
        return 1
    print(f"Site checks passed: {len(html_files)} HTML pages, CSS references, accessibility labels, and available JavaScript syntax.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
