import json
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent/'renderer'))
from render import wrap, scene_image, find_font
from PIL import ImageDraw, Image

class RendererTest(unittest.TestCase):
    def test_storyboard_can_be_drawn(self):
        story={'title':'رواج','width':640,'height':360,'scenes':[{'title':'محصولات دیجیتال ایران','subtitle':'کشف کن','duration':2,'theme':'midnight','visual':'headline','accent':'#67E8F9'}]}
        image=scene_image(story,story['scenes'][0],0)
        self.assertEqual(image.size,(640,360))
        with tempfile.TemporaryDirectory() as tmp:
            image.save(Path(tmp)/'preview.png')
            self.assertTrue((Path(tmp)/'preview.png').stat().st_size>1000)
    def test_text_wrap(self):
        d=ImageDraw.Draw(Image.new('RGB',(200,100)))
        self.assertGreater(len(wrap(d,'A sentence long enough to wrap into lines',find_font(25),100)),1)

if __name__=='__main__': unittest.main()
