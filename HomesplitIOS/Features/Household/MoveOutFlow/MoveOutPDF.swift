import Foundation
#if canImport(PDFKit)
import PDFKit
#endif
#if canImport(UIKit)
import UIKit
#endif

/// Generates a single-page settlement summary PDF to a temporary file.
/// Inputs come from the server-materialized `move_outs` row plus the
/// active roster at the time of move-out (for rendering names).
enum MoveOutPDF {
    struct Input {
        let household: Household
        let departingMember: Member
        let moveOut: MoveOut
        let activeMembers: [Member]
    }

    /// Writes a PDF to `tmp/HomesplitMoveOut-<id>.pdf` and returns the URL.
    /// Throws if PDF rendering fails. No Supabase side-effects.
    static func render(_ input: Input) throws -> URL {
        #if canImport(UIKit)
        let pageWidth: CGFloat = 612     // US Letter @ 72dpi
        let pageHeight: CGFloat = 792
        let bounds = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)

        let renderer = UIGraphicsPDFRenderer(bounds: bounds)
        let data = renderer.pdfData { ctx in
            ctx.beginPage()
            draw(into: bounds, input: input)
        }

        let fileName = "HomesplitMoveOut-\(input.moveOut.id.uuidString).pdf"
        let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(fileName)
        try data.write(to: url, options: .atomic)
        return url
        #else
        throw PDFError.unsupportedPlatform
        #endif
    }

    enum PDFError: Error, LocalizedError {
        case unsupportedPlatform

        var errorDescription: String? {
            switch self {
            case .unsupportedPlatform:
                return "PDF generation requires UIKit."
            }
        }
    }

    #if canImport(UIKit)
    private static func draw(into bounds: CGRect, input: Input) {
        let margin: CGFloat = 48
        var cursorY: CGFloat = margin
        let contentWidth = bounds.width - (margin * 2)

        let titleAttr: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 28, weight: .bold),
            .foregroundColor: UIColor.black
        ]
        let sectionAttr: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 13, weight: .semibold),
            .foregroundColor: UIColor.darkGray
        ]
        let bodyAttr: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 15, weight: .regular),
            .foregroundColor: UIColor.black
        ]
        let valueAttr: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 15, weight: .semibold),
            .foregroundColor: UIColor.black
        ]
        let footerAttr: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 11, weight: .regular),
            .foregroundColor: UIColor.gray
        ]

        func drawText(_ text: String, attrs: [NSAttributedString.Key: Any], at y: CGFloat) -> CGFloat {
            let rect = CGRect(x: margin, y: y, width: contentWidth, height: .greatestFiniteMagnitude)
            let str = NSAttributedString(string: text, attributes: attrs)
            let size = str.boundingRect(
                with: CGSize(width: contentWidth, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                context: nil
            ).size
            str.draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
            return y + size.height
        }

        func drawRow(label: String, value: String, y: CGFloat) -> CGFloat {
            let labelStr = NSAttributedString(string: label, attributes: sectionAttr)
            let valueStr = NSAttributedString(string: value, attributes: valueAttr)
            labelStr.draw(at: CGPoint(x: margin, y: y))
            let valueSize = valueStr.size()
            valueStr.draw(at: CGPoint(x: bounds.width - margin - valueSize.width, y: y))
            return y + max(labelStr.size().height, valueSize.height) + 8
        }

        func hr(y: CGFloat, inset: CGFloat = 0) -> CGFloat {
            let ctx = UIGraphicsGetCurrentContext()
            ctx?.setStrokeColor(UIColor.lightGray.withAlphaComponent(0.5).cgColor)
            ctx?.setLineWidth(0.5)
            ctx?.move(to: CGPoint(x: margin + inset, y: y))
            ctx?.addLine(to: CGPoint(x: bounds.width - margin - inset, y: y))
            ctx?.strokePath()
            return y + 12
        }

        cursorY = drawText("Move-out settlement", attrs: titleAttr, at: cursorY)
        cursorY += 4
        cursorY = drawText(input.household.name, attrs: bodyAttr, at: cursorY)
        cursorY += 12
        cursorY = hr(y: cursorY)

        cursorY = drawRow(label: "Departing", value: input.departingMember.displayName, y: cursorY)
        cursorY = drawRow(label: "Move-out date", value: isoDateLabel(input.moveOut.moveOutDate), y: cursorY)
        cursorY = drawRow(
            label: "Days present",
            value: "\(input.moveOut.proratedDaysPresent) of \(input.moveOut.cycleTotalDays)",
            y: cursorY
        )
        cursorY = drawRow(
            label: "Settlement amount",
            value: formatCurrency(input.moveOut.settlementAmount),
            y: cursorY
        )
        cursorY += 4
        cursorY = hr(y: cursorY)

        cursorY = drawText("Remaining household", attrs: sectionAttr, at: cursorY)
        cursorY += 4
        let remaining = input.activeMembers
            .filter { $0.id != input.departingMember.id }
            .map(\.displayName)
            .joined(separator: ", ")
        cursorY = drawText(
            remaining.isEmpty ? "No remaining active members." : remaining,
            attrs: bodyAttr,
            at: cursorY
        )
        cursorY += 16
        cursorY = hr(y: cursorY)

        cursorY = drawText("Notes", attrs: sectionAttr, at: cursorY)
        cursorY += 4
        cursorY = drawText(
            "Recurring bills in the final cycle were prorated to days-present. One-time expenses dated after the move-out date were removed from the departing member's share. Any freed amount has been redistributed across the remaining active roommates. Use Settle up to collect the final balance.",
            attrs: bodyAttr,
            at: cursorY
        )

        let footerText = "Generated by Homesplit · \(isoDateLabel(Date()))"
        _ = drawText(footerText, attrs: footerAttr, at: bounds.height - margin)
    }

    private static func isoDateLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.string(from: date)
    }

    private static func formatCurrency(_ amount: Decimal) -> String {
        amount.formatted(.currency(code: "USD"))
    }
    #endif
}
