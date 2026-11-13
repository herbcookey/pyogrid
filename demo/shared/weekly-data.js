// 데모용 가상 데이터: 문구 쇼핑몰의 주간 주문·출고 현황 (실제 데이터와 관계없음)
(function (global) {
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function formatDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function parseDate(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var r = new Date(d.getTime()); r.setDate(r.getDate() + n); return r; }
  function getMonday(d) { var day = (d.getDay() + 6) % 7; return addDays(d, -day); }
  function getIsoWeek(d) {
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    var firstThursday = new Date(t.getFullYear(), 0, 4);
    var week = 1 + Math.round(((t - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return { year: t.getFullYear(), week: week };
  }
  function weekLabel(monday) {
    var w = getIsoWeek(monday);
    var sunday = addDays(monday, 6);
    return "W" + pad2(w.week) + " (" + pad2(monday.getMonth() + 1) + "/" + pad2(monday.getDate()) +
      "~" + pad2(sunday.getMonth() + 1) + "/" + pad2(sunday.getDate()) + ")";
  }
  function getWeekInfo(baseDate) {
    var curMon = getMonday(parseDate(baseDate));
    var nextMon = addDays(curMon, 7);
    return {
      curStart: formatDate(curMon), curEnd: formatDate(addDays(curMon, 6)),
      nextStart: formatDate(nextMon), nextEnd: formatDate(addDays(nextMon, 6)),
      curLabel: weekLabel(curMon), nextLabel: weekLabel(nextMon),
      curWeekNo: "W" + pad2(getIsoWeek(curMon).week), nextWeekNo: "W" + pad2(getIsoWeek(nextMon).week)
    };
  }

  var BASE = [
    { OWNER: "홍길동", STORE: "SEOUL", SKU: "SKU-A1001", BARCODE: "8800000010017", VENDOR_CODE: "V-1001", CHANNEL: "온라인", REGION: "서울", CATEGORY: "필기구", CATEGORY_GROUP: "문구", ORDER_QTY: 12000, SHIP_QTY: 10500, NEXT_ORDER: 11000 },
    { OWNER: "홍길동", STORE: "SEOUL", SKU: "SKU-A1002", BARCODE: "8800000010024", VENDOR_CODE: "V-1002", CHANNEL: "온라인", REGION: "서울", CATEGORY: "필기구", CATEGORY_GROUP: "문구", ORDER_QTY: 8000, SHIP_QTY: 8000, NEXT_ORDER: 8000 },
    { OWNER: "김철수", STORE: "SEOUL", SKU: "SKU-B2001", BARCODE: "8800000020016", VENDOR_CODE: "V-2001", CHANNEL: "매장", REGION: "부산", CATEGORY: "노트", CATEGORY_GROUP: "지류", ORDER_QTY: 5000, SHIP_QTY: 3200, NEXT_ORDER: 6000 },
    { OWNER: "김철수", STORE: "SEOUL", SKU: "SKU-B2002", BARCODE: "8800000020023", VENDOR_CODE: "V-2002", CHANNEL: "매장", REGION: "부산", CATEGORY: "노트", CATEGORY_GROUP: "지류", ORDER_QTY: 3000, SHIP_QTY: 3500, NEXT_ORDER: 2500 },
    { OWNER: "이영희", STORE: "BUSAN", SKU: "SKU-C3001", BARCODE: "8800000030015", VENDOR_CODE: "V-3001", CHANNEL: "도매", REGION: "대구", CATEGORY: "가방", CATEGORY_GROUP: "생활", ORDER_QTY: 2000, SHIP_QTY: 0, NEXT_ORDER: 2000 },
    { OWNER: "이영희", STORE: "BUSAN", SKU: "SKU-C3002", BARCODE: "8800000030022", VENDOR_CODE: "V-3002", CHANNEL: "도매", REGION: "대구", CATEGORY: "가방", CATEGORY_GROUP: "생활", ORDER_QTY: 4500, SHIP_QTY: 4100, NEXT_ORDER: 0 }
  ];

  // count를 주면 기본 6행을 바탕으로 행을 늘린다 (스크롤 확인용)
  function buildSampleRows(count) {
    if (!count || count <= BASE.length) return BASE.map(function (r) { return Object.assign({}, r); });
    var out = [];
    var owners = ["홍길동", "김철수", "이영희", "박민수", "최지은"];
    for (var i = 0; i < count; i++) {
      var b = BASE[i % BASE.length];
      var order = 1000 + ((i * 7919) % 15000);
      var ship = Math.max(0, order - ((i * 104729) % 4000));
      out.push(Object.assign({}, b, {
        OWNER: owners[i % owners.length],
        SKU: "SKU-" + String.fromCharCode(65 + (i % 26)) + String(10000 + i),
        BARCODE: "880" + String(1000000000 + i * 37),
        VENDOR_CODE: "V-" + (1000 + i),
        ORDER_QTY: order, SHIP_QTY: ship, NEXT_ORDER: 1000 + ((i * 31) % 9000)
      }));
    }
    return out;
  }

  function normalizeRow(r) {
    var order = Number(r.ORDER_QTY) || 0;
    var ship = Number(r.SHIP_QTY) || 0;
    var backlog = Math.max(0, order - ship);
    var carry = r.CARRY_QTY != null ? Number(r.CARRY_QTY) : backlog;
    var nextOrder = Number(r.NEXT_ORDER) || 0;
    return Object.assign({}, r, {
      ORDER_QTY: order, SHIP_QTY: ship, BACKLOG_QTY: backlog,
      CARRY_QTY: carry, NEXT_ORDER: nextOrder, NEXT_TOTAL: nextOrder + carry,
      STATUS: r.STATUS || (backlog > 0 ? "미처리" : "-"),
      __selected__: backlog > 0
    });
  }

  global.WeeklyData = {
    pad2: pad2, formatDate: formatDate, parseDate: parseDate, addDays: addDays,
    getWeekInfo: getWeekInfo, buildSampleRows: buildSampleRows, normalizeRow: normalizeRow
  };
})(window);
