# lel-producer

Phone-friendly farm result pages for the Tasmanian Low Emissions Livestock (LEL) trial, served by GitHub Pages.
One page per participating farm, installable on a phone's home screen and usable offline.

- `participant-portal-<farm>.html`: the farm page. Reads the public `LEL_Participant_*_view` layers in ArcGIS Online.
- `participant-portal-<farm>.webmanifest`, `icon-*.png`, `apple-touch-icon.png`: install-as-app files.
- `sw.js`: service worker (offline). Bump `CACHE_VERSION` in it whenever a page or this file changes.

These files are GENERATED. Edit `participant-portal-farm-template.html` and run `build_participant_pages.py` in the
LEL project folder (10. ArcGIS / 04. HTML Scripts / 02. Producer Portal), then copy the results here.
The data comes from `lel-pipelines` (script 21). Pages are not listed anywhere; each farm is sent only its own link.
