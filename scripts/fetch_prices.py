#!/usr/bin/env python3
"""دریافت قیمت‌ها در سرور گیت‌هاب (هر ۱۵ دقیقه) و ساخت data/prices.json و data/history.json.
همه قیمت‌ها به تومان. چند منبع به ترتیب امتحان می‌شوند تا اگر یکی در دسترس نبود، بقیه جایگزین شوند."""
import json, os, re, sys, time, urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'}
SITE = os.environ.get('SITE_URL', '').rstrip('/')
OUT = os.path.join(os.path.dirname(__file__), '..', 'data')
log = []
OZ = 31.1034768


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8', 'replace'))


def num(v):
    if v is None:
        return None
    s = str(v)
    s = s.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'))
    s = re.sub(r'[^\d.\-]', '', s)
    try:
        return float(s)
    except ValueError:
        return None


def try_source(name, fn):
    try:
        got = fn()
        log.append(f'{name}: ok {sorted(k for k, v in got.items() if v)}')
        return got
    except Exception as e:  # noqa
        log.append(f'{name}: FAIL {type(e).__name__}: {e}')
        return {}


# ---------- BrsApi (با کلید در Secrets) ----------
def brsapi():
    key = os.environ.get('BRSAPI_KEY', '').strip()
    if not key:
        raise RuntimeError('no key')
    d = get(f'https://BrsApi.ir/Api/Market/Gold_Currency.php?key={key}')
    arrays = [d.get(k) or [] for k in ('gold', 'currency', 'cryptocurrency')] if isinstance(d, dict) else [d]
    def find(sym):
        for arr in arrays:
            for o in arr:
                if str(o.get('symbol', '')).upper() == sym:
                    p = num(o.get('price'))
                    if p and re.search('ریال|rial', str(o.get('unit', '')), re.I):
                        p /= 10
                    return {'price': p, 'change': num(o.get('change_percent'))} if p else None
    out = {'USD': find('USD'), 'EUR': find('EUR'), 'GBP': find('GBP'), 'AED': find('AED'),
           'G18': find('IR_GOLD_18K'), 'G24': find('IR_GOLD_24K')}
    try:
        idx = get(f'https://BrsApi.ir/Api/Tsetmc/Index.php?key={key}&type=1')
        lst = idx if isinstance(idx, list) else next((v for v in idx.values() if isinstance(v, list)), [])
        for o in lst:
            n = str(o.get('name', ''))
            if re.search(r'شاخص\s*(کل|كل)', n) and 'وزن' not in n:
                v = num(o.get('index') or o.get('value'))
                if v:
                    out['TEDPIX'] = {'price': v, 'change': num(o.get('index_change_percent') or o.get('change_percent'))}
                break
    except Exception as e:  # noqa
        log.append(f'brsapi index: FAIL {e}')
    return out


# ---------- tgju ----------
def tgju():
    d = None
    for host in ('call1', 'call2', 'call3', 'call4', 'call'):
        try:
            d = get(f'https://{host}.tgju.org/ajax.json')
            break
        except Exception as e:  # noqa
            log.append(f'tgju {host}: {type(e).__name__}')
    if not d:
        raise RuntimeError('all tgju hosts failed')
    cur = d.get('current', d)

    def item(key):
        o = cur.get(key)
        if not isinstance(o, dict):
            return None
        p = num(o.get('p'))
        if not p:
            return None
        ch = num(o.get('dp'))
        if ch is not None and o.get('dt') == 'low':
            ch = -abs(ch)
        return {'price': p / 10, 'change': ch}
    out = {'USD': item('price_dollar_rl'), 'EUR': item('price_eur'), 'GBP': item('price_gbp'),
           'AED': item('price_aed'), 'G18': item('geram18'), 'G24': item('geram24')}
    b = cur.get('bourse')
    if isinstance(b, dict) and num(b.get('p')):
        ch = num(b.get('dp'))
        if ch is not None and b.get('dt') == 'low':
            ch = -abs(ch)
        out['TEDPIX'] = {'price': num(b.get('p')), 'change': ch}
    return out


# ---------- شاخص بورس از TSETMC ----------
def tsetmc():
    d = get('https://cdn.tsetmc.com/api/Index/GetIndexB1LastAll/All/1', timeout=8)
    for o in d.get('indexB1', []):
        if str(o.get('insCode')) == '32097828799138957':
            return {'TEDPIX': {'price': num(o.get('xDrNivJIdx004')), 'change': num(o.get('xVarIdxJRfV'))}}
    raise RuntimeError('index not found')


# ---------- نوبیتکس (ممکن است برای آی‌پی خارج بسته باشد) ----------
def nobitex():
    d = get('https://api.nobitex.ir/market/stats?srcCurrency=usdt,paxg&dstCurrency=rls')
    st = d.get('stats', {})
    out = {}
    if 'usdt-rls' in st:
        out['USD'] = {'price': num(st['usdt-rls']['latest']) / 10, 'change': num(st['usdt-rls'].get('dayChange')), 'approx': True}
    if 'paxg-rls' in st:
        g24 = num(st['paxg-rls']['latest']) / 10 / OZ
        ch = num(st['paxg-rls'].get('dayChange'))
        out['G24'] = {'price': g24, 'change': ch, 'approx': True}
        out['G18'] = {'price': g24 * 0.75, 'change': ch, 'approx': True}
    return out


def main():
    now = int(time.time() * 1000)
    items = {}
    for name, fn in (('BrsApi', brsapi), ('TSETMC', tsetmc), ('tgju', tgju), ('Nobitex', nobitex)):
        got = try_source(name, fn)
        for sym, v in got.items():
            if v and v.get('price') and sym not in items:
                items[sym] = {**v, 'src': name, 'ts': now}

    # تاریخچه قبلی از خود سایت
    history = {}
    if SITE:
        try:
            history = get(f'{SITE}/data/history.json?t={now}')
        except Exception as e:  # noqa
            log.append(f'prev history: {type(e).__name__}')
    if not items and SITE:
        # اگر همه منابع شکست خوردند، آخرین قیمت‌های قبلی حفظ شود
        try:
            prev = get(f'{SITE}/data/prices.json?t={now}')
            items = prev.get('items', {})
            log.append('kept previous prices')
        except Exception:  # noqa
            pass
    for sym, v in items.items():
        if v.get('ts') != now:
            continue
        s = history.setdefault(sym, [])
        if not s or now - s[-1][0] >= 10 * 60e3:
            s.append([now, round(v['price'], 2)])
        # ۱۰ روز اخیر با جزئیات کامل، قبل از آن روزی یک نقطه، حداکثر ۲ سال
        cut = now - 10 * 864e5
        recent = [p for p in s if p[0] >= cut]
        old, seen = [], set()
        for p in reversed([p for p in s if p[0] < cut]):
            day = p[0] // 86400000
            if day not in seen:
                seen.add(day)
                old.append(p)
        history[sym] = (list(reversed(old)) + recent)[-1800:]

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'prices.json'), 'w', encoding='utf-8') as f:
        json.dump({'ts': now, 'items': items, 'log': log}, f, ensure_ascii=False)
    with open(os.path.join(OUT, 'history.json'), 'w', encoding='utf-8') as f:
        json.dump(history, f, separators=(',', ':'))
    print('\n'.join(log))
    summary = ' | '.join(log) + ' || items: ' + json.dumps({k: round(v['price']) for k, v in items.items()})
    print('::notice title=prices::' + summary.replace('\n', ' ')[:3000])


if __name__ == '__main__':
    main()
