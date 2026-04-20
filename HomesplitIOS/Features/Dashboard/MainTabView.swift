import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }

            ExpensesView()
                .tabItem { Label("Expenses", systemImage: "list.bullet") }

            BillsView()
                .tabItem { Label("Bills", systemImage: "calendar") }

            HouseholdView()
                .tabItem { Label("Household", systemImage: "person.2.fill") }
        }
    }
}

#Preview {
    MainTabView()
}
