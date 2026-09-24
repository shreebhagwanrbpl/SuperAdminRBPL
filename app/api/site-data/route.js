import { NextResponse } from "next/server";
import { getDocument, listCollection } from "@/lib/sqliteServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const type = searchParams.get("type");
        const websiteId = searchParams.get("websiteId");
        const companyId = searchParams.get("companyId");

        if (!websiteId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "websiteId is required",
                },
                { status: 400 }
            );
        }

        if (!type) {
            return NextResponse.json(
                {
                    success: false,
                    error: "type is required",
                },
                { status: 400 }
            );
        }

        /*
         * Standard Admin-managed site documents.
         *
         * websites/{websiteId}/pages/{type}
         */
        const documentPath = `websites/${websiteId}/pages/${type}`;

        /*
         * Handle districts separately because districts
         * are normally a collection rather than one document.
         */
        if (type === "districts") {
            const districtsPath = `websites/${websiteId}/pages/districts`;

            const districts = listCollection(districtsPath);

            return NextResponse.json(
                {
                    success: true,
                    type,
                    websiteId,
                    companyId: companyId || null,
                    data: districts,
                    districts,
                },
                {
                    status: 200,
                    headers: {
                        "Cache-Control": "no-store, no-cache, must-revalidate",
                    },
                }
            );
        }

        const data = getDocument(documentPath);

        return NextResponse.json(
            {
                success: true,
                type,
                websiteId,
                companyId: companyId || null,
                data: data || null,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                },
            }
        );
    } catch (error) {
        console.error("[Admin /api/site-data] Error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || "Failed to load site data",
                data: null,
            },
            { status: 500 }
        );
    }
}