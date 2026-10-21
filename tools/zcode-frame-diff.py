"""逐帧像素比对 + 差异区域的放大对照图。

判据要能证伪，所以不只看「哈希是否相同」：
  · 差异像素数 / 包围盒 / 最大通道差 —— 能把「整幅平移」与「一小块改了」分开
  · 再给出**放大对照图**，让「差的是什么」可以被眼睛判，而不是被数字猜
"""
import os
import sys
from PIL import Image, ImageChops, ImageDraw

before, after, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(outdir, exist_ok=True)

rows = []
for n in sorted(f for f in os.listdir(before) if f.endswith('.png')):
    pa = os.path.join(after, n)
    if not os.path.exists(pa):
        rows.append((n, None)); continue
    a = Image.open(os.path.join(before, n)).convert('RGB')
    b = Image.open(pa).convert('RGB')
    if a.size != b.size:
        rows.append((n, None)); continue
    d = ImageChops.difference(a, b)
    bbox = d.getbbox()
    if bbox is None:
        continue
    data = list(d.getdata())
    px = sum(1 for p in data if p != (0, 0, 0))
    rows.append((n, (bbox, px, max(max(p) for p in data))))

print(f'frames={len(os.listdir(before))} differing={len(rows)}')
for n, info in rows:
    if info is None:
        print(f'  {n}: missing or size differs'); continue
    bbox, px, mx = info
    print(f'  {n}: bbox={bbox} px={px} maxchannel={mx}')

# 放大对照：每张差异帧取包围盒外扩 24px，放大 8 倍，左=迁移前 / 右=迁移后
print()
for n, info in rows[:3]:
    if info is None:
        continue
    bbox, px, mx = info
    a = Image.open(os.path.join(before, n)).convert('RGB')
    b = Image.open(os.path.join(after, n)).convert('RGB')
    pad = 24
    box = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
           min(a.size[0], bbox[2] + pad), min(a.size[1], bbox[3] + pad))
    ca, cb = a.crop(box), b.crop(box)
    z = 8
    ca = ca.resize((ca.width * z, ca.height * z), Image.NEAREST)
    cb = cb.resize((cb.width * z, cb.height * z), Image.NEAREST)
    canvas = Image.new('RGB', (ca.width * 2 + 24, ca.height + 28), (30, 30, 34))
    canvas.paste(ca, (0, 28)); canvas.paste(cb, (ca.width + 24, 28))
    dr = ImageDraw.Draw(canvas)
    dr.text((6, 8), f'{n}  BEFORE (left)  |  AFTER (right)   bbox={bbox}', fill=(255, 220, 120))
    dr.line([(ca.width + 11, 0), (ca.width + 11, canvas.height)], fill=(255, 80, 80), width=2)
    out = os.path.join(outdir, f'zoom-{n}')
    canvas.save(out)
    print(f'  wrote {out}  ({canvas.width}x{canvas.height})')
