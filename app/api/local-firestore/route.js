import { NextResponse } from "next/server";

import {
  database,
  getDocument,
  setDocument,
  deleteDocument,
  listCollection,
  listAllDocuments,
  normalizePath,
  decodeValue,
} from "@/lib/sqliteServer";


// ============================================================
// NEXT.JS SERVER CONFIG
// ============================================================

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const revalidate = 0;


// ============================================================
// HELPERS
// ============================================================

function jsonError(error, status = 500) {

  const message =
    error instanceof Error
      ? error.message
      : String(error);


  console.error(
    "[local-firestore]",
    error
  );


  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
    }
  );

}


// ============================================================
// SERVER TIMESTAMP
// ============================================================

function reviveServerTimestamp(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }


  if (
    Array.isArray(value)
  ) {

    return value.map(
      reviveServerTimestamp
    );

  }


  if (
    typeof value !== "object"
  ) {

    return value;

  }


  if (
    value.__serverTimestamp
  ) {

    return new Date().toISOString();

  }


  const out = {};


  for (
    const [key, val]
    of Object.entries(value)
  ) {

    out[key] =
      reviveServerTimestamp(val);

  }


  return out;

}


// ============================================================
// GET FIELD
// ============================================================

function getField(
  obj,
  field
) {

  return String(field || "")
    .split(".")
    .reduce(
      (value, key) =>
        value == null
          ? undefined
          : value[key],
      obj
    );

}


// ============================================================
// NORMALIZE COMPARISON VALUE
// ============================================================

function normalizeComparable(
  value
) {

  if (
    value &&
    typeof value === "object" &&
    value.__sqliteType === "timestamp"
  ) {

    return value.value;

  }


  if (
    value &&
    typeof value === "object" &&
    value.__sqliteTimestamp
  ) {

    return (
      value.toMillis?.() ??
      value
    );

  }


  return value;

}


// ============================================================
// COMPARE
// ============================================================

function compare(
  a,
  b
) {

  a =
    normalizeComparable(a);

  b =
    normalizeComparable(b);


  if (
    a === b
  ) {

    return 0;

  }


  if (
    a == null
  ) {

    return -1;

  }


  if (
    b == null
  ) {

    return 1;

  }


  if (
    typeof a === "number" &&
    typeof b === "number"
  ) {

    return a - b;

  }


  if (
    typeof a === "boolean" &&
    typeof b === "boolean"
  ) {

    return (
      Number(a) -
      Number(b)
    );

  }


  if (
    typeof a === "string" &&
    typeof b === "string"
  ) {

    const dateA =
      Date.parse(a);

    const dateB =
      Date.parse(b);


    if (
      !Number.isNaN(dateA) &&
      !Number.isNaN(dateB)
    ) {

      return dateA - dateB;

    }

  }


  return String(a).localeCompare(
    String(b),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    }
  );

}


// ============================================================
// APPLY FILTERS
// ============================================================

function applyFilters(
  rows,
  filters = []
) {

  if (
    !Array.isArray(filters) ||
    filters.length === 0
  ) {

    return rows;

  }


  return rows.filter(
    ({ data }) => {

      return filters.every(
        ({
          field,
          op,
          value
        }) => {

          const actual =
            getField(
              data,
              field
            );


          switch (op) {

            case "==":

              return (
                actual ===
                value
              );


            case "!=":

              return (
                actual !==
                value
              );


            case "<":

              return (
                compare(
                  actual,
                  value
                ) < 0
              );


            case "<=":

              return (
                compare(
                  actual,
                  value
                ) <= 0
              );


            case ">":

              return (
                compare(
                  actual,
                  value
                ) > 0
              );


            case ">=":

              return (
                compare(
                  actual,
                  value
                ) >= 0
              );


            case "array-contains":

              return (
                Array.isArray(
                  actual
                ) &&
                actual.includes(
                  value
                )
              );


            case "in":

              return (
                Array.isArray(
                  value
                ) &&
                value.includes(
                  actual
                )
              );


            case "not-in":

              return (
                Array.isArray(
                  value
                ) &&
                !value.includes(
                  actual
                )
              );


            case "array-contains-any":

              return (
                Array.isArray(
                  actual
                ) &&
                Array.isArray(
                  value
                ) &&
                value.some(
                  item =>
                    actual.includes(
                      item
                    )
                )
              );


            default:

              return true;

          }

        }
      );

    }
  );

}


// ============================================================
// APPLY ORDERING
// ============================================================

function applyOrdering(
  rows,
  order = []
) {

  if (
    !Array.isArray(order) ||
    order.length === 0
  ) {

    return rows;

  }


  for (
    let i = order.length - 1;
    i >= 0;
    i -= 1
  ) {

    const item =
      order[i] || {};


    const field =
      item.field;


    const direction =
      String(
        item.direction ||
        "asc"
      ).toLowerCase();


    rows.sort(
      (a, b) => {

        const result =
          compare(
            getField(
              a.data,
              field
            ),
            getField(
              b.data,
              field
            )
          );


        return direction === "desc"
          ? -result
          : result;

      }
    );

  }


  return rows;

}


// ============================================================
// GET
// ============================================================

export async function GET(
  request
) {

  try {

    const {
      searchParams
    } =
      new URL(
        request.url
      );


    const op =
      searchParams.get(
        "op"
      ) || "get";


    const path =
      normalizePath(
        searchParams.get(
          "path"
        ) || ""
      );


    // ----------------------------------------------------
    // OPERATIONS THAT DON'T REQUIRE PATH
    // ----------------------------------------------------

    const operationsWithoutPath =
      new Set([
        "all",
        "queryNotifications",
      ]);


    if (
      !path &&
      !operationsWithoutPath.has(
        op
      )
    ) {

      return NextResponse.json(
        {
          ok: false,
          error:
            "path is required",
        },
        {
          status: 400,
        }
      );

    }


    // ====================================================
    // GET DOCUMENT
    // ====================================================

    if (
      op === "get"
    ) {

      const data =
        getDocument(
          path
        );


      return NextResponse.json({

        ok: true,

        exists:
          data !== null,

        data,

      });

    }


    // ====================================================
    // COLLECTION
    // ====================================================

    if (
      op === "collection"
    ) {

      let filters = [];

      let order = [];


      const rawFilters =
        searchParams.get(
          "filters"
        );


      const rawOrder =
        searchParams.get(
          "order"
        );


      // ------------------------------------------------
      // FILTERS
      // ------------------------------------------------

      if (
        rawFilters
      ) {

        try {

          filters =
            JSON.parse(
              rawFilters
            );

        } catch {

          return NextResponse.json(
            {
              ok: false,
              error:
                "Invalid filters JSON",
            },
            {
              status: 400,
            }
          );

        }

      }


      // ------------------------------------------------
      // ORDER
      // ------------------------------------------------

      if (
        rawOrder
      ) {

        try {

          order =
            JSON.parse(
              rawOrder
            );

        } catch {

          return NextResponse.json(
            {
              ok: false,
              error:
                "Invalid order JSON",
            },
            {
              status: 400,
            }
          );

        }

      }


      const requestedLimit =
        Number(
          searchParams.get(
            "limit"
          ) || 0
        );


      let rows =
        listCollection(
          path
        );


      rows =
        applyFilters(
          rows,
          filters
        );


      rows =
        applyOrdering(
          rows,
          order
        );


      const total =
        rows.length;


      if (
        Number.isFinite(
          requestedLimit
        ) &&
        requestedLimit > 0
      ) {

        rows =
          rows.slice(
            0,
            requestedLimit
          );

      }


      return NextResponse.json({

        ok: true,

        docs:
          rows.map(
            row => ({

              id:
                row.id,

              data:
                row.data,

            })
          ),

        count:
          total,

      });

    }


    // ====================================================
    // QUERY NOTIFICATIONS
    // ====================================================

    if (
      op === "queryNotifications"
    ) {

      let since =
        Number(
          searchParams.get(
            "since"
          ) || 0
        );


      if (
        !Number.isFinite(
          since
        )
      ) {

        since = 0;

      }


      const rows =
        database
          .prepare(
            `
                        SELECT
                            path,
                            collection_path,
                            doc_id,
                            data,
                            updated_at
                        FROM documents
                        WHERE updated_at > ?
                        AND (
                            collection_path LIKE 'websitesQueries/%/contactQueries'
                            OR collection_path LIKE 'websitesQueries/%/productQueries'
                        )
                        ORDER BY updated_at ASC
                        `
          )
          .all(
            since
          );


      const docs =
        rows.map(
          row => ({

            path:
              row.path,

            collectionPath:
              row.collection_path,

            id:
              row.doc_id,

            data:
              decodeValue(
                row.data
              ),

            updatedAt:
              Number(
                row.updated_at
              ) || 0,

          })
        );


      return NextResponse.json({

        ok: true,

        docs,

        count:
          docs.length,

        serverTime:
          Date.now(),

      });

    }


    // ====================================================
    // ALL DOCUMENTS
    // ====================================================

    if (
      op === "all"
    ) {

      return NextResponse.json({

        ok: true,

        docs:
          listAllDocuments(),

      });

    }


    // ====================================================
    // UNSUPPORTED GET
    // ====================================================

    return NextResponse.json(
      {
        ok: false,
        error:
          `Unsupported GET operation: ${op}`,
      },
      {
        status: 400,
      }
    );


  } catch (error) {

    return jsonError(
      error
    );

  }

}


// ============================================================
// POST
// ============================================================

export async function POST(
  request
) {

  try {

    const body =
      await request.json();


    const {

      op = "set",

      path,

      data,

      merge = false,

      paths = [],

    } =
      body || {};


    // ====================================================
    // SET
    // ====================================================

    if (
      op === "set"
    ) {

      const normalizedPath =
        normalizePath(
          path || ""
        );


      if (
        !normalizedPath
      ) {

        return NextResponse.json(
          {
            ok: false,
            error:
              "path is required",
          },
          {
            status: 400,
          }
        );

      }


      const saved =
        setDocument(
          normalizedPath,

          reviveServerTimestamp(
            data || {}
          ),

          !!merge
        );


      return NextResponse.json({

        ok: true,

        data:
          saved,

      });

    }


    // ====================================================
    // UPDATE
    // ====================================================

    if (
      op === "update"
    ) {

      const normalizedPath =
        normalizePath(
          path || ""
        );


      if (
        !normalizedPath
      ) {

        return NextResponse.json(
          {
            ok: false,
            error:
              "path is required",
          },
          {
            status: 400,
          }
        );

      }


      const existing =
        getDocument(
          normalizedPath
        );


      if (
        existing === null
      ) {

        return NextResponse.json(
          {
            ok: false,
            error:
              "Document does not exist",
          },
          {
            status: 404,
          }
        );

      }


      const updated = {

        ...(existing || {}),

        ...reviveServerTimestamp(
          data || {}
        ),

      };


      const saved =
        setDocument(
          normalizedPath,
          updated,
          false
        );


      return NextResponse.json({

        ok: true,

        data:
          saved,

      });

    }


    // ====================================================
    // DELETE
    // ====================================================

    if (
      op === "delete"
    ) {

      const normalizedPath =
        normalizePath(
          path || ""
        );


      if (
        !normalizedPath
      ) {

        return NextResponse.json(
          {
            ok: false,
            error:
              "path is required",
          },
          {
            status: 400,
          }
        );

      }


      deleteDocument(
        normalizedPath
      );


      return NextResponse.json({

        ok: true,

      });

    }


    // ====================================================
    // BATCH
    // ====================================================

    if (
      op === "batch"
    ) {

      if (
        !Array.isArray(
          paths
        )
      ) {

        return NextResponse.json(
          {
            ok: false,
            error:
              "paths must be an array",
          },
          {
            status: 400,
          }
        );

      }


      for (
        const item
        of paths
      ) {

        if (
          !item?.path
        ) {

          continue;

        }


        const itemPath =
          normalizePath(
            item.path
          );


        if (
          !itemPath
        ) {

          continue;

        }


        if (
          item.op ===
          "delete"
        ) {

          deleteDocument(
            itemPath
          );

          continue;

        }


        setDocument(

          itemPath,

          reviveServerTimestamp(
            item.data || {}
          ),

          !!item.merge

        );

      }


      return NextResponse.json({

        ok: true,

        count:
          paths.length,

      });

    }


    // ====================================================
    // COUNT
    // ====================================================

    if (
      op === "count"
    ) {

      const normalizedPath =
        normalizePath(
          path || ""
        );


      if (
        !normalizedPath
      ) {

        return NextResponse.json(
          {
            ok: false,
            error:
              "path is required",
          },
          {
            status: 400,
          }
        );

      }


      const rows =
        listCollection(
          normalizedPath
        );


      return NextResponse.json({

        ok: true,

        count:
          rows.length,

      });

    }


    // ====================================================
    // UNSUPPORTED POST
    // ====================================================

    return NextResponse.json(
      {
        ok: false,
        error:
          `Unsupported POST operation: ${op}`,
      },
      {
        status: 400,
      }
    );


  } catch (error) {

    return jsonError(
      error
    );

  }

}