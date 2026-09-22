import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const root = path.join(
  process.cwd(),
  "public",
  "uploads"
);

const rootResolved = path.resolve(root);


// ============================================================
// SAFE PATH
// ============================================================

function safePath(input) {
  const clean = String(input || "")
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/");

  const resolved = path.resolve(
    rootResolved,
    clean
  );

  // Prevent ../ path traversal
  if (
    resolved !== rootResolved &&
    !resolved.startsWith(rootResolved + path.sep)
  ) {
    throw new Error(
      "Invalid storage path"
    );
  }

  return resolved;
}


// ============================================================
// NORMALIZE PUBLIC URL
// ============================================================

function publicUploadUrl(relative) {
  const clean = String(relative || "")
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/");

  return `/uploads/${clean}`;
}


// ============================================================
// POST - UPLOAD FILE
// ============================================================

export async function POST(request) {

  try {

    const form =
      await request.formData();

    const file =
      form.get("file");

    const relative =
      form.get("path");


    // ----------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------

    if (
      !file ||
      !relative
    ) {

      return NextResponse.json(
        {
          error:
            "file and path required"
        },
        {
          status: 400
        }
      );

    }


    // ----------------------------------------------------
    // VALIDATE FILE
    // ----------------------------------------------------

    if (
      typeof file.arrayBuffer !==
      "function"
    ) {

      return NextResponse.json(
        {
          error:
            "Invalid file"
        },
        {
          status: 400
        }
      );

    }


    // ----------------------------------------------------
    // SAFE TARGET
    // ----------------------------------------------------

    const relativeString =
      String(relative)
        .replace(/^[/\\]+/, "")
        .replace(/\\/g, "/");


    const target =
      safePath(
        relativeString
      );


    // ----------------------------------------------------
    // CREATE DIRECTORY
    // ----------------------------------------------------

    fs.mkdirSync(
      path.dirname(target),
      {
        recursive: true
      }
    );


    // ----------------------------------------------------
    // READ FILE
    // ----------------------------------------------------

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );


    // ----------------------------------------------------
    // WRITE FILE
    // ----------------------------------------------------

    fs.writeFileSync(
      target,
      buffer
    );


    // ----------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------

    return NextResponse.json({

      ok: true,

      metadata: {

        size:
          buffer.length,

        contentType:
          file.type ||
          "application/octet-stream"

      },

      url:
        publicUploadUrl(
          relativeString
        )

    });

  } catch (e) {

    console.error(
      "[uploads] POST error:",
      e
    );


    return NextResponse.json(
      {
        error:
          e?.message ||
          "Upload failed"
      },
      {
        status: 500
      }
    );

  }

}


// ============================================================
// GET - LIST FILES
// ============================================================

export async function GET(request) {

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
      );


    const relative =
      searchParams.get(
        "path"
      ) || "";


    // ----------------------------------------------------
    // OPERATION VALIDATION
    // ----------------------------------------------------

    if (
      op !== "list"
    ) {

      return NextResponse.json(
        {
          error:
            "Unsupported operation"
        },
        {
          status: 400
        }
      );

    }


    // ----------------------------------------------------
    // SAFE BASE DIRECTORY
    // ----------------------------------------------------

    const base =
      safePath(
        relative
      );


    // ----------------------------------------------------
    // DIRECTORY DOES NOT EXIST
    // ----------------------------------------------------

    if (
      !fs.existsSync(
        base
      )
    ) {

      return NextResponse.json({
        items: []
      });

    }


    // ----------------------------------------------------
    // ENSURE DIRECTORY
    // ----------------------------------------------------

    if (
      !fs.statSync(
        base
      ).isDirectory()
    ) {

      return NextResponse.json(
        {
          error:
            "Path is not a directory"
        },
        {
          status: 400
        }
      );

    }


    // ----------------------------------------------------
    // WALK DIRECTORY
    // ----------------------------------------------------

    const files = [];


    const walk = (
      dir
    ) => {

      const entries =
        fs.readdirSync(
          dir,
          {
            withFileTypes:
              true
          }
        );


      for (
        const entry
        of entries
      ) {

        const full =
          path.join(
            dir,
            entry.name
          );


        if (
          entry.isDirectory()
        ) {

          walk(
            full
          );

        } else if (
          entry.isFile()
        ) {

          const relativeFile =
            path.relative(
              rootResolved,
              full
            )
              .split(
                path.sep
              )
              .join("/");


          files.push(
            relativeFile
          );

        }

      }

    };


    walk(
      base
    );


    // ----------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------

    return NextResponse.json({
      items: files
    });

  } catch (e) {

    console.error(
      "[uploads] GET error:",
      e
    );


    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to list files"
      },
      {
        status: 500
      }
    );

  }

}


// ============================================================
// DELETE - DELETE FILE
// ============================================================

export async function DELETE(
  request
) {

  try {

    const {
      searchParams
    } =
      new URL(
        request.url
      );


    const relative =
      searchParams.get(
        "path"
      ) || "";


    // ----------------------------------------------------
    // PATH VALIDATION
    // ----------------------------------------------------

    if (
      !relative
    ) {

      return NextResponse.json(
        {
          error:
            "path required"
        },
        {
          status: 400
        }
      );

    }


    const target =
      safePath(
        relative
      );


    // ----------------------------------------------------
    // DELETE
    // ----------------------------------------------------

    if (
      fs.existsSync(
        target
      )
    ) {

      const stat =
        fs.statSync(
          target
        );


      if (
        stat.isDirectory()
      ) {

        fs.rmSync(
          target,
          {
            recursive:
              true,
            force:
              true
          }
        );

      } else {

        fs.rmSync(
          target,
          {
            force:
              true
          }
        );

      }

    }


    // ----------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------

    return NextResponse.json({
      ok: true
    });

  } catch (e) {

    console.error(
      "[uploads] DELETE error:",
      e
    );


    return NextResponse.json(
      {
        error:
          e?.message ||
          "Delete failed"
      },
      {
        status: 500
      }
    );

  }

}