import SwiftUI

struct BillsView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Bills",
                systemImage: "calendar.badge.clock",
                description: Text("Recurring bills coming soon.")
            )
            .navigationTitle("Bills")
        }
    }
}

#Preview {
    BillsView()
}
