"""Ndërton faqen nga dosja detyra/ dhe e shkruan te _site/.

Ekzekutohet vetë nga GitHub Actions sa herë shton foto. Nuk ke nevojë ta prekësh.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import unicodedata
from datetime import datetime, timezone

from PIL import Image, ImageOps

try:
    import pillow_heif  # fotot .heic të iPhone (dhe .avif në versionet e vjetra të Pillow)
    pillow_heif.register_heif_opener()
    if hasattr(pillow_heif, "register_avif_opener") and ".avif" not in Image.registered_extensions():
        pillow_heif.register_avif_opener()
except ImportError:
    pass

Image.MAX_IMAGE_PIXELS = 300_000_000  # lejon edhe foto panoramike shumë të mëdha

try:
    from zoneinfo import ZoneInfo
    ZONA = ZoneInfo("Europe/Tirane")
except Exception:
    ZONA = None

RRENJA = os.path.dirname(os.path.abspath(__file__))
DETYRA = os.path.join(RRENJA, "detyra")
FAQJA = os.path.join(RRENJA, "faqja")
DALJA = os.path.join(RRENJA, "_site")
FOTOT = os.path.join(DALJA, "f")
ORARI = os.path.join(RRENJA, "orari.txt")

# Renditja e lëndëve në faqe. Lëndët që s'janë këtu dalin në fund, sipas alfabetit.
RENDITJA = [
    "Gjuhë shqipe", "Letërsi", "Anglisht", "Gjermanisht", "Matematikë", "Fizikë",
    "Kimi", "Biologji", "Histori", "Gjeografi", "Qytetari",
]

LLOJET = {
    ".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".webp", ".heic", ".heif", ".avif",
    ".gif", ".bmp", ".tif", ".tiff",
}
# Fillimi i emrit të ditës -> numri i ditës (0 = e diel). Pranon edhe "hane", "mekrure".
DITET = [("die", 0), ("han", 1), ("hen", 1), ("mar", 2), ("mer", 3), ("mek", 3),
         ("enj", 4), ("pre", 5), ("sht", 6)]
VERSIONI = "2"  # ndryshimi i tij rigjeneron të gjitha fotot
# p = e plotë (shkarko/kopjo/zmadho), m = për ekran, t = e vogël në listë. (madhësia, cilësia)
MADHESITE = {"p": (2560, 90), "m": (1600, 84), "t": (520, 80)}

_DATE = r"(\d{4})[-.](\d{1,2})[-.](\d{1,2})|(\d{1,2})[-.](\d{1,2})[-.](\d{4})"
# "2026-09-22 Përshkrim", "22.09.2026", "15.09.2026 - 19.09.2026 Java e kaluar", ...
EMRI_DOSJES = re.compile(
    r"^\s*(?:" + _DATE + r")(?:\s*(?:deri më|deri|–|-|_)\s*(?:" + _DATE + r"))?\s*[-–_:,.]?\s*(.*)$",
    re.IGNORECASE,
)


def nfc(s):
    # macOS i ruan shkronjat si "ë" të ndara; i bashkojmë që të krahasohen saktë.
    return unicodedata.normalize("NFC", s)


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "x"


def natyral(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", nfc(s))]


def eshte_foto(emri):
    return not emri.startswith(".") and os.path.splitext(emri)[1].lower() in LLOJET


def data_iso(grupet):
    if grupet[0]:
        y, m, d = grupet[0:3]
    elif grupet[3]:
        d, m, y = grupet[3:6]
    else:
        return None
    try:
        return datetime(int(y), int(m), int(d)).date().isoformat()
    except ValueError:
        return None


def lexo_emrin(emri):
    """Kthen (data, deri, pershkrimi) nga emri i dosjes."""
    m = EMRI_DOSJES.match(nfc(emri))
    if not m:
        return None, None, nfc(emri).strip()
    g = m.groups()
    data, deri = data_iso(g[0:6]), data_iso(g[6:12])
    if not data:
        return None, None, nfc(emri).strip()
    if deri and deri < data:
        data, deri = deri, data
    return data, (deri if deri != data else None), g[12].strip()


def datat_nga_git():
    """Për çdo skedar: kur u shtua për herë të parë (nga historia e git)."""
    try:
        dalja = subprocess.run(
            ["git", "-c", "core.quotepath=off", "log", "--format=@@%cI", "--name-only", "--", "detyra"],
            cwd=RRENJA, capture_output=True, check=True,
        ).stdout.decode("utf-8", "replace")
    except (OSError, subprocess.CalledProcessError):
        return {}
    datat, tani = {}, None
    for rresht in dalja.splitlines():
        if rresht.startswith("@@"):
            tani = rresht[2:].strip()
        elif rresht.strip() and tani:
            datat[nfc(rresht.strip())] = tani  # git log shkon nga më i riu te më i vjetri
    return datat


GIT = {}


def kur_u_shtua(shtegu):
    rel = nfc(os.path.relpath(shtegu, RRENJA).replace(os.sep, "/"))
    if rel in GIT:
        t = datetime.fromisoformat(GIT[rel])
    else:
        t = datetime.fromtimestamp(os.path.getmtime(shtegu), timezone.utc)
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def dita_lokale(iso_utc):
    t = datetime.strptime(iso_utc, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return (t.astimezone(ZONA) if ZONA else t).date().isoformat()


def ne_rgb(im):
    if im.mode.startswith("I") or im.mode == "F":  # PNG/TIFF 16-bit
        im = im.convert("I").point(lambda v: v * (1 / 256)).convert("L")
    if im.mode in ("RGBA", "LA", "P", "PA") or "transparency" in im.info:
        im = im.convert("RGBA")
        sfond = Image.new("RGB", im.size, "white")
        sfond.paste(im, mask=im.getchannel("A"))
        return sfond
    return im.convert("RGB")


def perpuno(shtegu, perdorur):
    """Bën tri madhësitë e fotos. Kthen shtigjet dhe përmasat, ose None."""
    with open(shtegu, "rb") as f:
        h = hashlib.sha1(f.read() + VERSIONI.encode()).hexdigest()[:16]
    emrat = {k: f"f/{h}-{k}.jpg" for k in MADHESITE}
    if not all(os.path.exists(os.path.join(DALJA, e)) for e in emrat.values()):
        try:
            with Image.open(shtegu) as im:
                im.seek(0)  # GIF/WebP me animacion: merret pamja e parë
                try:
                    im = ImageOps.exif_transpose(im)
                except Exception:
                    pass  # EXIF i dëmtuar: foto mbetet siç është
                im = ne_rgb(im)
                for k, (madhesia, cilesia) in MADHESITE.items():  # nga më e madhja te më e vogla
                    im.thumbnail((madhesia, madhesia), Image.LANCZOS)
                    im.save(os.path.join(DALJA, emrat[k]), "JPEG", quality=cilesia, optimize=True,
                            progressive=True, subsampling=0 if k == "p" else 2)
        except Exception as e:
            print(f"  ! S'u lexua {os.path.relpath(shtegu, RRENJA)}: {e}")
            return None
    with Image.open(os.path.join(DALJA, emrat["p"])) as im:
        w, gj = im.size
    perdorur.update(emrat.values())
    return dict(emrat, w=w, h=gj)


def fotot_e_dosjes(dosja):
    """Fotot direkt në dosje vijnë të parat, pastaj nëndosjet (p.sh. Libri, Fletore)."""
    rezultati = []
    for rrenja, dosjet, skedaret in os.walk(dosja):
        dosjet[:] = sorted((d for d in dosjet if not d.startswith((".", "_"))), key=natyral)
        grupi = os.path.relpath(rrenja, dosja)
        grupi = "" if grupi == "." else nfc(grupi.replace(os.sep, " · "))
        for s in sorted(filter(eshte_foto, skedaret), key=natyral):
            rezultati.append((grupi, os.path.join(rrenja, s)))
    return rezultati


def ndertoj_postim(id_, data, deri, pershkrim, skedaret, perdorur):
    fotot, shtuar = [], ""
    for grupi, shtegu in skedaret:
        f = perpuno(shtegu, perdorur)
        if f:
            f["g"] = grupi
            fotot.append(f)
            shtuar = max(shtuar, kur_u_shtua(shtegu))
    if not fotot:
        return None
    return {
        "id": id_, "data": data or dita_lokale(shtuar), "deri": deri,
        "pershkrim": pershkrim, "shtuar": shtuar, "foto": fotot,
    }


def ndertoj_lenden(dosja_lendes, perdorur):
    postimet, te_lira = [], {}
    for emri in sorted(os.listdir(dosja_lendes), key=natyral):
        if emri.startswith((".", "_")):
            continue
        shtegu = os.path.join(dosja_lendes, emri)
        if os.path.isdir(shtegu):
            data, deri, pershkrim = lexo_emrin(emri)
            p = ndertoj_postim(slug(emri), data, deri, pershkrim, fotot_e_dosjes(shtegu), perdorur)
            if p:
                postimet.append(p)
        elif eshte_foto(emri):
            # Fotot e hedhura direkt te lënda grupohen sipas ditës kur u shtuan.
            te_lira.setdefault(dita_lokale(kur_u_shtua(shtegu)), []).append(("", shtegu))

    for dita, skedaret in te_lira.items():
        p = ndertoj_postim("d-" + dita, dita, None, "", skedaret, perdorur)
        if p:
            postimet.append(p)

    postimet.sort(key=lambda p: (p["data"], p["shtuar"]), reverse=True)
    pare = set()
    for p in postimet:
        baza, n = p["id"], 2
        while p["id"] in pare:
            p["id"], n = f"{baza}-{n}", n + 1
        pare.add(p["id"])
    return postimet


def pergatit_logon():
    """Nëse ke vënë faqja/logo.png (ose .jpg), bën prej saj logon e kokës dhe ikonat e telefonit."""
    for ext in ("png", "jpg", "jpeg", "webp"):
        burimi = os.path.join(FAQJA, "logo." + ext)
        if os.path.exists(burimi):
            break
    else:
        return False
    with Image.open(burimi) as im:
        im = ImageOps.exif_transpose(im).convert("RGBA")
        web = im.copy()
        web.thumbnail((176, 176), Image.LANCZOS)
        web.save(os.path.join(DALJA, "logo-web.png"), optimize=True)
        for s in (180, 192, 512):
            sfond = Image.new("RGBA", (s, s), (255, 253, 247, 255))
            ik = im.copy()
            ik.thumbnail((int(s * .8), int(s * .8)), Image.LANCZOS)
            sfond.paste(ik, ((s - ik.width) // 2, (s - ik.height) // 2), ik)
            sfond.convert("RGB").save(os.path.join(DALJA, f"ikona-{s}.png"), optimize=True)
    return True


def kopjo_faqen():
    for emri in os.listdir(FAQJA):
        if not emri.startswith("logo.") or emri == "logo.svg":
            shutil.copy2(os.path.join(FAQJA, emri), os.path.join(DALJA, emri))
    ka_logo = pergatit_logon()

    ikonat = ([{"src": f"ikona-{s}.png", "sizes": f"{s}x{s}", "type": "image/png", "purpose": "any"} for s in (192, 512)]
              if ka_logo else [{"src": "logo.svg", "sizes": "any", "type": "image/svg+xml"}])
    manifest = {
        "name": "PostimDSH", "short_name": "PostimDSH", "description": "Detyrat e shtëpisë – Viti i parë",
        "lang": "sq", "start_url": "./", "display": "standalone",
        "background_color": "#f7f3ea", "theme_color": "#fffdf7", "icons": ikonat,
    }
    with open(os.path.join(DALJA, "manifest.webmanifest"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False)

    # Shton ?v=... që shfletuesit të marrin gjithmonë versionin e ri të stilit dhe kodit.
    versionet = {}
    for emri in os.listdir(FAQJA):
        if emri.endswith((".css", ".js")):
            with open(os.path.join(FAQJA, emri), "rb") as f:
                versionet[emri] = hashlib.sha1(f.read()).hexdigest()[:8]
    for faqe in (e for e in os.listdir(FAQJA) if e.endswith(".html")):
        shtegu = os.path.join(DALJA, faqe)
        with open(shtegu, encoding="utf-8") as f:
            html = f.read()
        if ka_logo:
            html = (html
                    .replace('<link rel="icon" href="logo.svg" type="image/svg+xml">', '<link rel="icon" href="ikona-192.png" type="image/png">')
                    .replace('<link rel="apple-touch-icon" href="logo.svg">', '<link rel="apple-touch-icon" href="ikona-180.png">')
                    .replace('src="logo.svg"', 'src="logo-web.png"'))
        for emri, v in versionet.items():
            html = html.replace(f'"{emri}"', f'"{emri}?v={v}"')
        with open(shtegu, "w", encoding="utf-8") as f:
            f.write(html)


def lexo_orarin(lendet):
    """Lexon orari.txt. Lëndët lidhen me dosjet edhe kur emri s'është i njëjti saktë (p.sh. "Fizik")."""
    if not os.path.exists(ORARI):
        return []
    sipas_id = {l["id"]: l["emri"] for l in lendet}

    def gjej(emri):
        s = slug(emri)
        if s in sipas_id:
            return s
        if len(s) >= 4:
            for id_ in sipas_id:
                if id_.startswith(s) or s.startswith(id_):
                    return id_
        return None

    orari = {}
    with open(ORARI, encoding="utf-8-sig") as f:
        for rresht in f:
            rresht = rresht.split("#", 1)[0].strip()
            if ":" not in rresht:
                continue
            dita_teksti, lendet_teksti = rresht.split(":", 1)
            d = re.sub(r"^e-", "", slug(dita_teksti))
            dita = next((n for fillimi, n in DITET if d.startswith(fillimi)), None)
            if dita is None:
                print(f"  ! orari.txt: s'e kuptova ditën \"{dita_teksti.strip()}\"")
                continue
            for emri in re.split(r"[,;]", lendet_teksti):
                emri = nfc(emri).strip()
                if emri:
                    id_ = gjej(emri)
                    orari.setdefault(dita, []).append(
                        {"id": id_ or slug(emri), "emri": sipas_id[id_] if id_ else emri, "ka": bool(id_)})
    # E hëna e para, e diela e fundit.
    return [{"dita": d, "lendet": orari[d]} for d in sorted(orari, key=lambda d: (d + 6) % 7)]


def main():
    global GIT
    GIT = datat_nga_git()
    os.makedirs(FOTOT, exist_ok=True)
    perdorur = set()

    renditja = {n.lower(): i for i, n in enumerate(RENDITJA)}
    emrat = [d for d in os.listdir(DETYRA)
             if os.path.isdir(os.path.join(DETYRA, d)) and not d.startswith((".", "_"))]
    emrat.sort(key=lambda d: (renditja.get(nfc(d).strip().lower(), len(RENDITJA)), natyral(d)))

    lendet = []
    for emri in emrat:
        postimet = ndertoj_lenden(os.path.join(DETYRA, emri), perdorur)
        lendet.append({"id": slug(emri), "emri": nfc(emri).strip(), "postime": postimet})
        print(f"{nfc(emri)}: {len(postimet)} postime, {sum(len(p['foto']) for p in postimet)} foto")

    for emri in os.listdir(FOTOT):
        if f"f/{emri}" not in perdorur:
            os.remove(os.path.join(FOTOT, emri))

    kopjo_faqen()
    te_dhenat = {
        "gjeneruar": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "lendet": lendet,
        "orari": lexo_orarin(lendet),
    }
    with open(os.path.join(DALJA, "te-dhenat.json"), "w", encoding="utf-8") as f:
        json.dump(te_dhenat, f, ensure_ascii=False, separators=(",", ":"))
    print("Gati.")


if __name__ == "__main__":
    main()
