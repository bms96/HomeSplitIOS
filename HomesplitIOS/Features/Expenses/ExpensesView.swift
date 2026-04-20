import SwiftUI

struct ExpensesView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Expenses",
                systemImage: "list.bullet.rectangle",
                description: Text("Expense list coming soon.")
            )
            .navigationTitle("Expenses")
        }
    }
}

#Preview {
    ExpensesView()
}
