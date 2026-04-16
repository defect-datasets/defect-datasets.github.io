/// <reference path="./datatables.min.js" />

const paperData = JSON.parse($("#paper-data").text());

const singleTagRenderer =
  (classes, display = undefined) =>
  (data, type, row, meta) =>
    $("<span class='tag'>")
      .addClass(classes)
      .data({ value: data, colIndex: meta.col })
      .text(display || data)
      .get(0);

const multiTagRenderer =
  (classes, fallback = undefined) =>
  (data, type, row, meta) =>
    data.length > 0
      ? $(data.map((d) => singleTagRenderer(classes)(d, type, row, meta)))
          .wrapAll("<span class='tag-container'/>")
          .parent()
          .get(0)
      : singleTagRenderer(["gray"], fallback)(undefined, type, row, meta);

const titleRenderer = (data, type, row) =>
  $("<a>").text(data).attr({ href: row.url, target: "_blank" }).get(0);

function getLinkText(number, total, type) {
  let result = "Link";
  if (total > 1) result += ` ${number}`;
  if (type === "dead") result += " (dead)";
  return result;
}

const artifactRenderer = (data) =>
  data.length > 0
    ? data
        .map(
          (v, i) =>
            $("<a class='artifact' />")
              .text(getLinkText(i + 1, data.length, v.type))
              .addClass(v.type)
              .attr({ href: v.href, target: "_blank" })
              .get(0).outerHTML
        )
        .join(", ")
    : "<span class='empty'>None</span>";

function downloadJson(dt) {
  const data = Array.from(dt.rows({ search: "applied" }).data());
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    $("<a>").attr({ href: objectUrl, download: "datasets.json" }).get(0).click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** The "render" object is not automatically merged, so I have to manually merge them */
const DEFAULT_RENDERERS = {
  raw: (d) => d,
  csv: (d) => (d instanceof Array ? d.join(";") : d),
};

const table = $("#paper-table").DataTable({
  data: paperData,
  paging: false,
  fixedHeader: true,
  scrollX: true,
  layout: {
    top: "searchBuilder",
    topStart: {
      buttons: [
        {
          text: $("#dl-icon").html() + " JSON",
          action: (e, dt) => downloadJson(dt),
        },
        {
          extend: "csv",
          exportOptions: { orthogonal: "csv" },
          filename: "datasets",
          text: $("#dl-icon").html() + " CSV",
        },
      ],
    },
    topEnd: "info",
    bottomStart: null,
  },
  searchBuilder: {
    columns: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  language: {
    searchBuilder: {
      title: "Table Filters (%d active)",
    },
  },
  columnDefs: [
    {
      targets: "_all",
      render: DEFAULT_RENDERERS,
    },
    {
      targets: [3, 4, 5, 6, 7],
      type: "array",
      searchBuilder: { orthogonal: "raw" },
    },
  ],
  columns: [
    {
      data: "title",
      title: "Title",
      render: { ...DEFAULT_RENDERERS, display: titleRenderer },
    },
    { data: "year", title: "Year" },
    {
      data: "venue",
      title: "Venue",
      render: { ...DEFAULT_RENDERERS, display: singleTagRenderer(["blue"]) },
    },
    {
      data: "domain",
      title: "Domain",
      render: { ...DEFAULT_RENDERERS, display: multiTagRenderer(["green", "lower"]) },
    },
    {
      data: "type",
      title: "Type",
      render: { ...DEFAULT_RENDERERS, display: multiTagRenderer(["green", "lower"]) },
    },
    {
      data: "lang",
      title: "Language",
      render: {
        ...DEFAULT_RENDERERS,
        display: multiTagRenderer(["green", "lower"], "unspecified"),
      },
    },
    {
      data: "source",
      title: "Source",
      render: {
        ...DEFAULT_RENDERERS,
        display: multiTagRenderer(["green", "lower"], "other/unknown"),
      },
    },
    {
      data: "presentation",
      title: "Presentation",
      render: {
        ...DEFAULT_RENDERERS,
        display: multiTagRenderer(["green", "lower"], "unknown"),
      },
    },
    {
      data: "artifacts",
      title: "Artifacts",
      render: {
        ...DEFAULT_RENDERERS,
        display: artifactRenderer,
        csv: (a) => a.map((v) => v.href).join(";"),
      },
      orderable: false,
    },
  ],
});

function criteriaEqual(a, b) {
  return (
    a.condition === b.condition &&
    a.data === b.data &&
    a.value.length === b.value.length &&
    a.value.every((v, i) => v === b.value[i])
  );
}

$(".tag").on("click", (e) => {
  const { value, colIndex } = $(e.target).data();
  let curCriteria = table.searchBuilder.getDetails();
  if (Object.keys(curCriteria).length === 0) {
    curCriteria = { logic: "AND", criteria: [] };
  }

  const column = table.column(colIndex);

  let thisCriterion;
  if (value === undefined) {
    thisCriterion = { condition: "null", data: column.title(), value: [] };
  } else if (column.type() === "array") {
    thisCriterion = { condition: "contains", data: column.title(), value: [value] };
  } else {
    thisCriterion = { condition: "=", data: column.title(), value: [value] };
  }

  let toRemove = [];
  for (let i = 0; i < curCriteria.criteria.length; i++) {
    if (criteriaEqual(curCriteria.criteria[i], thisCriterion)) {
      toRemove.push(i);
    }
  }

  if (toRemove.length === 0) {
    curCriteria.criteria.push(thisCriterion);
  } else {
    for (const i of toRemove.reverse()) {
      curCriteria.criteria.splice(i, 1);
    }
  }
  table.searchBuilder.rebuild(curCriteria);
});
