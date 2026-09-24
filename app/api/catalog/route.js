import { NextResponse } from "next/server";
import { getDocument } from "@/lib/sqliteServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

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

        /*
         * Master products are stored under:
         *
         * websites/{websiteId}/pages/products
         *
         * The sqliteServer normalizePath() handles the
         * company grouping internally.
         */
        const productPaths = [
            `websites/${websiteId}/pages/products`,
            `websites/${websiteId}/pages/categoryproducts`,
        ];

        let products = null;

        for (const path of productPaths) {
            const data = getDocument(path);

            if (data) {
                products = data;
                break;
            }
        }

        /*
         * Some installations may store products inside
         * a pages document structure. Return the actual
         * stored data without adding dummy products.
         */
        if (!products) {
            return NextResponse.json(
                {
                    success: true,
                    products: [],
                    data: [],
                    websiteId,
                    companyId: companyId || null,
                },
                {
                    status: 200,
                    headers: {
                        "Cache-Control": "no-store, no-cache, must-revalidate",
                    },
                }
            );
        }

        return NextResponse.json(
            {
                success: true,
                products: Array.isArray(products) ? products : products.products || [],
                data: products,
                websiteId,
                companyId: companyId || null,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                },
            }
        );
    } catch (error) {
        console.error("[Admin /api/catalog] Error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || "Failed to load catalog",
                products: [],
                data: [],
            },
            { status: 500 }
        );
    }
}