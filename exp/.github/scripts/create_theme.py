import colorsys
import html
import os
import re
from pathlib import Path

THEMES_FILE = Path("css/themes.css")
INDEX_FILE = Path("index.html")
UI_FILE = Path("ui.js")
COLOR_PATTERN = re.compile(r"^#?[0-9a-fA-F]{6}$")
ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")


def required(name):
    value = os.environ[name].strip()
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def color(name):
    value = required(name)
    if not COLOR_PATTERN.fullmatch(value):
        raise SystemExit(f"{name} must be a six-digit hex color such as #1A2B3C or 1A2B3C")
    return f"#{value.lstrip('#').upper()}"


def rgb(hex_color):
    return tuple(int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5))


def hex_color(red, green, blue):
    return "#{:02X}{:02X}{:02X}".format(round(red * 255), round(green * 255), round(blue * 255))


def adjust_lightness(value, amount):
    red, green, blue = rgb(value)
    hue, lightness, saturation = colorsys.rgb_to_hls(red, green, blue)
    lightness = max(0, min(1, lightness + amount))
    return hex_color(*colorsys.hls_to_rgb(hue, lightness, saturation))


def mix(first, second, weight):
    first_rgb = rgb(first)
    second_rgb = rgb(second)
    return hex_color(*(first_channel * weight + second_channel * (1 - weight) for first_channel, second_channel in zip(first_rgb, second_rgb)))


def replace_once(text, old, new, description):
    if old not in text:
        raise SystemExit(f"Could not find insertion point for {description}")
    return text.replace(old, new, 1)


def main():
    name = required("THEME_NAME")
    theme_id = required("THEME_ID")
    mode = required("THEME_MODE")

    if not ID_PATTERN.fullmatch(theme_id):
        raise SystemExit("THEME_ID must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens")
    if mode not in {"dark", "light"}:
        raise SystemExit("THEME_MODE must be dark or light")

    bg_base = color("BG_BASE")
    bg_card = color("BG_CARD")
    text_heading = color("TEXT_HEADING")
    text_body = color("TEXT_BODY")
    text_muted = color("TEXT_MUTED")
    primary = color("PRIMARY_COLOR")
    secondary = color("BRAND_SECONDARY")
    accent = color("ACCENT_COLOR")

    css = THEMES_FILE.read_text()
    selector = f":root.{theme_id}-theme"
    if selector in css:
        raise SystemExit(f"Theme ID '{theme_id}' already exists in {THEMES_FILE}")

    dark = mode == "dark"
    bg_raised = adjust_lightness(bg_card, 0.06 if dark else -0.04)
    border_neutral = mix(bg_raised, text_muted, 0.72 if dark else 0.82)
    highlight_border = mix(border_neutral, text_heading, 0.72)
    primary_dark = adjust_lightness(primary, -0.08)
    primary_light = adjust_lightness(primary, 0.10)
    success = "#6FBF73" if dark else "#2E7D32"
    warning = "#F2C14E" if dark else "#9A6700"
    error = "#E57373" if dark else "#B3261E"
    shadow_sm = f"0 1px 3px rgba(0, 0, 0, {'0.45' if dark else '0.10'})"
    shadow_md = f"0 6px 16px rgba(0, 0, 0, {'0.45' if dark else '0.12'})"
    shadow_lg = f"0 16px 40px rgba(0, 0, 0, {'0.50' if dark else '0.16'})"

    theme_block = f'''

/* {name} theme */
:root.{theme_id}-theme,
html.{theme_id}-theme,
body.{theme_id}-theme {{
    --bg-base: {bg_base};
    --bg-card: {bg_card};
    --bg-raised: {bg_raised};

    --text-heading: {text_heading};
    --text-body: {text_body};
    --text-muted: {text_muted};

    --border-neutral: {border_neutral};
    --highlight-border: {highlight_border};

    --primary-color: {primary};
    --primary-dark: {primary_dark};
    --primary-light: {primary_light};
    --brand-secondary: {secondary};
    --section-heading-color: var(--brand-secondary);
    --accent-color: {accent};

    --success-color: {success};
    --warning-color: {warning};
    --error-color: {error};

    --footnote-hover-bg: color-mix(in srgb, var(--primary-color) 18%, transparent);

    --shadow-sm: {shadow_sm};
    --shadow-md: {shadow_md};
    --shadow-lg: {shadow_lg};
}}
'''
    THEMES_FILE.write_text(css.rstrip() + theme_block)

    index = INDEX_FILE.read_text()
    option_value = html.escape(theme_id, quote=True)
    if f'value="{option_value}"' in index:
        raise SystemExit(f"Theme option '{theme_id}' already exists in {INDEX_FILE}")
    option = f'\t\t\t\t\t\t\t\t\t<option value="{option_value}">{html.escape(name)} ({mode.title()})</option>\n'
    index = replace_once(index, '\t\t\t\t\t\t\t\t</select>', option + '\t\t\t\t\t\t\t\t</select>', "theme selector option")
    index = replace_once(index, "vigil: 1 };", f"vigil: 1, {theme_id}: 1 }};", "prepaint theme allowlist")
    INDEX_FILE.write_text(index)

    ui = UI_FILE.read_text()
    theme_class = f"{theme_id}-theme"
    ui = replace_once(ui, "'gnome-theme'];", f"'gnome-theme', '{theme_class}'];", "theme class list")
    bg_entry = f"\t'{theme_class}':        {{ dark: '{bg_base}', light: '{bg_base}' }},\n"
    ui = replace_once(ui, "};\n\nexport function updateThemeColor()", bg_entry + "};\n\nexport function updateThemeColor()", "theme-color background map")
    UI_FILE.write_text(ui)


if __name__ == "__main__":
    main()
