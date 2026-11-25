"""Browser smoke checks; run from repository root after installing Playwright."""
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parent.parent
URL = "http://127.0.0.1:8765"

def main():
    from playwright.sync_api import sync_playwright
    with subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1"],
                          cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as server:
        try:
            for _ in range(50):
                try:
                    with urlopen(URL, timeout=1):
                        break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError("local test server did not start")
            with sync_playwright() as p:
                browser = p.chromium.launch(channel="chrome") if os.environ.get("VIMO_TEST_VIDEO") == "1" else p.chromium.launch()
                page = browser.new_page(accept_downloads=True)
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(URL + "/research/index.html")
                page.locator("#demo").click()
                assert "90" in page.locator("#status").inner_text()
                assert "88.9%" in page.locator("#summary").inner_text()
                with page.expect_download() as download:
                    page.locator("#json").click()
                assert download.value.suggested_filename == "vimo-report.json"
                page.locator("#toSignal").click()
                page.wait_for_url("**/experiments.html?transfer=pose")
                assert "90 帧" in page.locator("#aName").inner_text()
                assert "实验完成" in page.locator("#status").inner_text()
                page.goto(URL + "/research/index.html")
                page.locator("#demo").click()
                page.locator("#toValidation").click()
                page.wait_for_url("**/validation.html?transfer=angle")
                assert "90 条" in page.locator("#predName").inner_text()
                page.goto(URL + "/research/index.html")
                page.locator("#demo").click()
                page.locator("#toDynamics").click()
                page.wait_for_url("**/dynamics.html?transfer=pose")
                assert "实验完成" in page.locator("#status").inner_text()
                page.locator("#demo").click()
                assert "1.0000 s" in page.locator("#stats").inner_text()
                assert page.locator("#export").is_enabled()
                page.goto(URL + "/research/experiments.html")
                page.locator("#demo").click()
                assert "实验完成" in page.locator("#status").inner_text()
                assert "路径平均绝对角差" in page.locator("#dtwInfo").inner_text()
                assert page.locator("#export").is_enabled()
                page.goto(URL + "/research/resources.html")
                with page.expect_download() as download:
                    page.locator("#demo").click()
                assert download.value.suggested_filename == "vimo-demo.csv"
                page.goto(URL + "/research/validation.html")
                page.locator("#demo").click()
                assert "93.44%" in page.locator("#metrics").inner_text()
                assert "2.000" in page.locator("#metrics").inner_text()
                assert page.locator("#export").is_enabled()
                page.goto(URL + "/research/video.html")
                assert page.locator("#source option").count() == 3
                page.locator("#source").select_option(index=1)
                assert page.locator("#videoFile").is_disabled()
                if os.environ.get("VIMO_TEST_VIDEO") == "1":
                    page.locator("#duration").fill("3")
                    page.locator("#fps").fill("5")
                    print("Media support:", page.evaluate("""() => ({
                        h264: document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'),
                        hevc: document.createElement('video').canPlayType('video/mp4; codecs="hvc1"'),
                        webm: document.createElement('video').canPlayType('video/webm; codecs="vp8"')
                    })"""))
                    page.locator("#start").click()
                    page.wait_for_function("document.querySelector('#download').disabled === false || document.querySelector('#status').textContent.startsWith('未完成')", timeout=180000)
                    status = page.locator("#status").inner_text()
                    print(status)
                    assert page.locator("#download").is_enabled(), status
                    with page.expect_download() as download:
                        page.locator("#download").click()
                    import csv
                    with open(download.value.path(), encoding="utf-8") as f:
                        rows = list(csv.DictReader(f))
                    assert rows and any(row["x"] != "" for row in rows), "No human landmark detected in demo video"
                    print("Real video extraction produced", len(rows), "landmark rows")
                    page.locator("#toWorkbench").click()
                    page.wait_for_url("**/research/index.html?transfer=pose")
                    assert "视频骨骼提取结果" in page.locator("#status").inner_text()
                    assert page.locator("#summary tr").count() == 7
                screenshots = ROOT / "research" / ".test-output"
                screenshots.mkdir(exist_ok=True)
                for width in (390, 768, 1440):
                    page.set_viewport_size({"width": width, "height": 900})
                    for route in ("index.html", "video.html", "experiments.html", "dynamics.html", "validation.html", "resources.html"):
                        page.goto(URL + "/research/" + route)
                        assert page.locator('nav a[aria-current="page"]').count() == 1
                        assert page.locator('nav a[aria-current="page"]').get_attribute("href") == route
                        if route in ("index.html", "experiments.html", "dynamics.html", "validation.html"):
                            page.locator("#demo").click()
                        if width in (390, 1440):
                            page.screenshot(path=str(screenshots / f"{route[:-5]}-{width}.png"), full_page=True)
                        overflow = page.evaluate("""() => ({
                            width: document.documentElement.scrollWidth,
                            viewport: innerWidth,
                            elements: Array.from(document.querySelectorAll('main *')).filter(e =>
                                e.getBoundingClientRect().right > innerWidth + 2 &&
                                !e.closest('pre, .scroll, canvas')
                            ).slice(0, 8).map(e => [e.tagName, e.className, Math.round(e.getBoundingClientRect().right)])
                        })""")
                        assert overflow["width"] <= width + 2, (width, route, overflow)
                for width in (390, 1440):
                    page.set_viewport_size({"width": width, "height": 900})
                    page.goto(URL + "/index.html", wait_until="domcontentloaded")
                    assert "Vimo Research" in page.title()
                    assert page.locator(".research-route-grid a").count() == 6
                    assert page.locator("#hero-screen video").get_attribute("poster")
                    if width == 390:
                        stage = page.locator(".stage-visual").bounding_box()
                        copy = page.locator(".stage-copy").bounding_box()
                        assert stage["y"] >= copy["y"] + copy["height"] - 2, (stage, copy)
                        assert stage["width"] >= width * .8, stage
                    page.screenshot(path=str(screenshots / f"portal-{width}.png"), full_page=False, animations="disabled")
                    page.locator('.research-route-grid a[href="research/dynamics.html"]').click()
                    page.wait_for_url("**/research/dynamics.html")
                assert not errors, errors
                browser.close()
            print("Browser smoke tests passed")
        finally:
            server.terminate()

if __name__ == "__main__":
    main()
