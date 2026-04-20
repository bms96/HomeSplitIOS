import XCTest

final class SmokeFlowTests: XCTestCase {
    func test_launchDoesNotCrash() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["Homesplit"].waitForExistence(timeout: 10))
    }
}
