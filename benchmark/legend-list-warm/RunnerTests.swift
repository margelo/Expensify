//
//  RunnerTests.swift
//  AgentDeviceRunnerUITests
//
//  Created by Michał Pierzchała on 30/01/2026.
//

import XCTest
import Network
#if canImport(UIKit)
import UIKit
typealias RunnerImage = UIImage
#elseif canImport(AppKit)
import AppKit
typealias RunnerImage = NSImage
#endif

final class RunnerTests: XCTestCase {
  enum RunnerErrorDomain {
    static let general = "AgentDeviceRunner"
    static let exception = "AgentDeviceRunner.NSException"
  }

  enum RunnerErrorCode {
    static let noResponseFromMainThread = 1
    static let commandReturnedNoResponse = 2
    static let mainThreadExecutionTimedOut = 3
    static let objcException = 1
  }

  static let springboardBundleId = "com.apple.springboard"
  // SpringBoard hosts blocking system modals on iOS/visionOS; tvOS (PineBoard/HeadBoard)
  // and macOS have no such host, so there is nothing to probe there.
  static let hasSpringBoardSystemModalHost: Bool = {
    #if os(tvOS) || os(macOS)
      return false
    #else
      return true
    #endif
  }()
  static let defaultRecordingFps: Int32 = 15
  var listener: NWListener?
  var doneExpectation: XCTestExpectation?
  let transportQueue = DispatchQueue(label: "agent-device.runner.transport")
  let commandExecutionQueue = DispatchQueue(label: "agent-device.runner.commands")
  let app = XCUIApplication()
  lazy var springboard = XCUIApplication(bundleIdentifier: Self.springboardBundleId)
  var currentApp: XCUIApplication?
  var currentBundleId: String?
  var currentAppProcessIdentifier: Int?
  // iOS does not reliably expose hasKeyboardFocus for a bare type request, especially when
  // hardware-keyboard input hides the software keyboard. A successful tap on a concrete text
  // input is a scoped witness for the immediately-following bare type; lifecycle and non-text
  // interactions clear it before it can become stale.
  var textEntryTapWitness: TextEntryTapWitness?
  let maxRequestBytes = 2 * 1024 * 1024
  let mainThreadExecutionTimeout: TimeInterval = 30
  let appExistenceTimeout: TimeInterval = 30
  let retryCooldown: TimeInterval = 0.2
  let postSnapshotInteractionDelay: TimeInterval = 0.2
  let firstInteractionAfterActivateDelay: TimeInterval = 0.25
  let scrollInteractionIdleTimeoutDefault: TimeInterval = 1.0
  let tvRemoteDoublePressDelayDefault: TimeInterval = 0.0
  // Keep a periodic XCTest liveness marker in runner.log without flooding long-lived sessions.
  let xctestIdleKeepaliveInterval: TimeInterval = 60.0
  let minRecordingFps = 1
  let maxRecordingFps = 120
  var needsPostSnapshotInteractionDelay = false
  var needsFirstInteractionDelay = false
  var runnerAccessibilityHealth: RunnerAccessibilityHealth = .unknown
  var activeRecording: ScreenRecorder?
  let commandJournal = RunnerCommandJournal()
  // Coalesces duplicate transport sends of the same commandId onto the single in-flight
  // execution instead of enqueueing them again behind it (#1105 capture pileup).
  let inFlightCommandLock = NSLock()
  var inFlightCommandIds: Set<String> = []
  var inFlightCommandWaiters: [String: [((data: Data, shouldFinish: Bool)) -> Void]] = [:]
  // Tracks main-queue work abandoned by the execution watchdog so new main-thread commands
  // fail fast as busy instead of queueing behind work that cannot be cancelled (#1105).
  let mainThreadWorkLock = NSLock()
  var abandonedMainThreadWorkCount = 0
  var abandonedMainThreadWorkSince: Date?
  // Past this age the runner stops claiming "busy, retry soon" and reports itself wedged so
  // the daemon recycles it — the only cure once the main thread is stuck for good.
  let mainThreadWedgeThreshold: TimeInterval = 120
  // Sticky per-bundle hint: after an XCTest-backed snapshot tier ground past its slice (or a
  // snapshot was abandoned by the watchdog), later capture plans avoid the XCTest accessibility
  // channel when an independent recovery backend exists, or use a bounded XCTest probe when it
  // does not, for the same screen class (#1105/#1156).
  let snapshotXCTestChannelPenaltyLock = NSLock()
  var snapshotXCTestChannelPenaltyBundleId: String?
  var snapshotXCTestChannelPenaltyUntil = Date.distantPast
  let snapshotXCTestChannelPenaltyDuration: TimeInterval = 120
  var snapshotXCTestPenaltyWarmupExemptionPending = false
  // Sticky per-bundle hint for the private AX depth ladder: deep RN screens reject the default
  // depth with kAXErrorIllegalArgument on EVERY capture, so once a shallower rung is accepted
  // later captures start there instead of re-paying the rejected deep request (~300ms per
  // capture on the Bluesky feed). Shares the penalty's lifetime model: same duration, cleared
  // on target process change, so screens that regain deep-capture ability are re-probed.
  let privateAXAcceptedDepthLock = NSLock()
  var privateAXAcceptedDepthBundleId: String?
  // PID-bound: a relaunch (external or A->B->A while inactive) changes the process, and the new
  // tree may accept the full depth again. Any invalidation path that drops the cached PID makes
  // the memory unmatchable, so every fresh activation re-probes the full requested depth.
  var privateAXAcceptedDepthProcessIdentifier: Int?
  var privateAXAcceptedDepth: Int?
  var privateAXAcceptedDepthUntil = Date.distantPast
  // Bluesky-class screens can grind ~4-8s before an XCTest-backed snapshot tier fails; anything
  // past this threshold marks the screen hostile so the next capture uses non-XCTest recovery.
  let snapshotXCTestSlowCaptureThreshold: TimeInterval = 3
  // The blocking XCTest tree snapshot XPC runs on the main thread with this slice so a
  // content-dependent grind (#1105: seconds to minutes on live Bluesky screens) cannot pin
  // the capture plan. On timeout the XPC keeps grinding on main; while any abandoned
  // tree capture is outstanding, plans skip XCTest-backed tiers (tree, query sweep) until the
  // abandoned work drains.
  let treeCaptureLock = NSLock()
  var abandonedTreeCaptureCount = 0
  let treeCaptureSliceBudget: TimeInterval = 8
  // Bounds the pre-plan SpringBoard system-modal probe, which can otherwise grind for tens of
  // seconds on remote-hosted consent dialogs and bypass the plan budget (#1244).
  let systemModalProbeBudget: TimeInterval = 4
  // Observability for the record(_:) suppression below: how many AX-broken-screen snapshot
  // issues this session muted, so wedge investigations see the volume without grepping logs.
  let suppressedIssueLock = NSLock()
  var suppressedAxSnapshotIssueCount = 0
  let interactiveTypes: Set<XCUIElement.ElementType> = [
    .button,
    .cell,
    .checkBox,
    .collectionView,
    .link,
    .menuItem,
    .picker,
    .searchField,
    .segmentedControl,
    .slider,
    .stepper,
    .switch,
    .tabBar,
    .textField,
    .secureTextField,
    .textView,
    .webView
  ]
  // Keep blocker actions narrow to avoid false positives from generic hittable containers.
  let actionableTypes: Set<XCUIElement.ElementType> = [
    .button,
    .cell,
    .link,
    .menuItem,
    .checkBox,
    .switch
  ]

  // MARK: - XCTest Entry

  override func setUp() {
    continueAfterFailure = true
  }

  /// True for the one recorded-issue class the runner deliberately mutes: an AX-server error
  /// (`kAXError*`) inside a "Failed to get matching snapshot" fetch. The kAXError token
  /// intentionally covers kAXErrorIllegalArgument and its sibling AX server codes (e.g.
  /// kAXErrorCannotComplete): any AX-server rejection inside a matching-snapshot fetch is the
  /// same capture-plan noise the plan already classifies and recovers from. The timeout
  /// variant ("Failed to get matching snapshot: Timed out while evaluating UI query.") carries
  /// no kAXError token and MUST keep recording — it signals a genuinely hung query, exactly
  /// the pathology XCTEST_RECORDED_FAILURE must stay able to see.
  static func isSuppressedAxSnapshotIssueDescription(_ description: String) -> Bool {
    description.contains("Failed to get matching snapshot") && description.contains("kAXError")
  }

  /// On AX-broken screens (deep RN trees, #758/#1105) XCUIApplication queries record
  /// "Failed to get matching snapshot: ... kAXError..." issues; XCTest tears the whole test
  /// case down once a few accumulate, killing the long-lived runner right after the command
  /// completes and forcing a ~25s restart per capture. This override is deliberately
  /// suite-global (all commands, not just snapshot capture): tap-triggered element queries on
  /// the same screens record the same noise and would still tear the runner down, and command
  /// outcomes stay honest through their own error paths — only this issue side-channel is
  /// muted. Everything else still records (and still drives XCTEST_RECORDED_FAILURE).
  override func record(_ issue: XCTIssue) {
    let description = issue.compactDescription
    if Self.isSuppressedAxSnapshotIssueDescription(description) {
      suppressedIssueLock.lock()
      suppressedAxSnapshotIssueCount += 1
      let count = suppressedAxSnapshotIssueCount
      suppressedIssueLock.unlock()
      NSLog(
        "AGENT_DEVICE_RUNNER_AX_SNAPSHOT_ISSUE_SUPPRESSED count=%ld description=%@",
        count,
        description
      )
      return
    }
    super.record(issue)
  }

  @MainActor
  func testFlashListWarmFastScroll() throws {
    runWarmReportActionsListBenchmark(
      bundleIdentifier: "com.chrispader.expensify.expensifylite.flashlist"
    )
  }

  @MainActor
  func testLegendListWarmFastScroll() throws {
    runWarmReportActionsListBenchmark(
      bundleIdentifier: "com.chrispader.expensify.expensifylite.legendlist"
    )
  }

  @MainActor
  func testFlashListReportPrecondition() throws {
    openWarmReportActionsList(
      XCUIApplication(bundleIdentifier: "com.chrispader.expensify.expensifylite.flashlist")
    )
  }

  @MainActor
  func testLegendListReportPrecondition() throws {
    openWarmReportActionsList(
      XCUIApplication(bundleIdentifier: "com.chrispader.expensify.expensifylite.legendlist")
    )
  }

  @MainActor
  func testFlashListResetToTail() throws {
    resetReportActionsListToTail(
      bundleIdentifier: "com.chrispader.expensify.expensifylite.flashlist"
    )
  }

  @MainActor
  func testLegendListResetToTail() throws {
    resetReportActionsListToTail(
      bundleIdentifier: "com.chrispader.expensify.expensifylite.legendlist"
    )
  }

  @MainActor
  private func resetReportActionsListToTail(bundleIdentifier: String) {
    let targetApp = XCUIApplication(bundleIdentifier: bundleIdentifier)
    openWarmReportActionsList(targetApp)
  }

  @MainActor
  private func runWarmReportActionsListBenchmark(bundleIdentifier: String) {
    let targetApp = XCUIApplication(bundleIdentifier: bundleIdentifier)

    let measureOptions = XCTMeasureOptions()
    measureOptions.iterationCount = 1
    measureOptions.invocationOptions = [.manuallyStart, .manuallyStop]
    let metrics: [XCTMetric] = [
      XCTClockMetric(),
      XCTCPUMetric(application: targetApp),
      XCTMemoryMetric(application: targetApp),
    ]

    measure(
      metrics: metrics,
      options: measureOptions
    ) {
      _ = prepareWarmReportActionsListInbox(targetApp)
      startMeasuring()
      performApproximateGestureReportActionsListBenchmark(targetApp)
      stopMeasuring()
    }

    sleep(1)
  }

  @MainActor
  private func performApproximateGestureReportActionsListBenchmark(
    _ targetApp: XCUIApplication
  ) {
    // XCUITest offsets use screen points rather than physical pixels.
    let chatTapYOffset: CGFloat = 200
    // XCTest's predefined velocities use sentinel raw values, so keep the
    // adjustable baseline as an explicit screen-point velocity for scaling.
    let baseSwipeVelocityPointsPerSecond: CGFloat = 3_500
    let baseSwipeVelocity = XCUIGestureVelocity(
      rawValue: baseSwipeVelocityPointsPerSecond
    )
    let acceleratedSwipeVelocityFactor: CGFloat = 1.5
    let acceleratedSwipeVelocity = XCUIGestureVelocity(
      rawValue: baseSwipeVelocity.rawValue * acceleratedSwipeVelocityFactor
    )
    let interSwipeDelay: TimeInterval = 0.4
    // XCUITest serializes touches, so alternate two short downward paths to
    // approximate a user rapidly scrolling toward older actions with both thumbs.
    let thumbSwipePaths: [(start: XCUICoordinate, end: XCUICoordinate)] = [
      (
        start: targetApp.coordinate(
          withNormalizedOffset: CGVector(dx: 0.34, dy: 0.30)
        ),
        end: targetApp.coordinate(
          withNormalizedOffset: CGVector(dx: 0.34, dy: 0.62)
        )
      ),
      (
        start: targetApp.coordinate(
          withNormalizedOffset: CGVector(dx: 0.66, dy: 0.30)
        ),
        end: targetApp.coordinate(
          withNormalizedOffset: CGVector(dx: 0.66, dy: 0.62)
        )
      ),
    ]
    let chatTapCoordinate = targetApp.coordinate(
      withNormalizedOffset: CGVector(dx: 0.5, dy: 0)
    ).withOffset(CGVector(dx: 0, dy: chatTapYOffset))

    sleep(2)
    chatTapCoordinate.tap()
    sleep(5)

    performApproximateAlternatingThumbListStress(
      swipePaths: thumbSwipePaths,
      baseVelocity: baseSwipeVelocity,
      acceleratedVelocity: acceleratedSwipeVelocity,
      interSwipeDelay: interSwipeDelay
    )
  }

  @MainActor
  private func performApproximateAlternatingThumbListStress(
    swipePaths: [(start: XCUICoordinate, end: XCUICoordinate)],
    baseVelocity: XCUIGestureVelocity,
    acceleratedVelocity: XCUIGestureVelocity,
    interSwipeDelay: TimeInterval
  ) {
    performReportActionsListSwipes(
      paths: swipePaths,
      velocity: baseVelocity,
      count: 10,
      interSwipeDelay: interSwipeDelay
    )
    sleep(2)
    performReportActionsListSwipes(
      paths: swipePaths,
      velocity: acceleratedVelocity,
      count: 10,
      interSwipeDelay: interSwipeDelay
    )
    sleep(2)
    performReportActionsListSwipes(
      paths: swipePaths,
      velocity: acceleratedVelocity,
      count: 10,
      interSwipeDelay: interSwipeDelay
    )
    sleep(5)
  }

  // Retained for reproducing the original element-driven benchmark flow.
  @MainActor
  private func performLegacyWarmReportActionsListBenchmark(
    _ targetApp: XCUIApplication,
    reportRow: XCUIElement
  ) {
    let towardOlderStart = targetApp.coordinate(
      withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)
    )
    let towardOlderEnd = targetApp.coordinate(
      withNormalizedOffset: CGVector(dx: 0.5, dy: 0.70)
    )
    let benchmarkVelocity: XCUIGestureVelocity = 100_000
    let fasterBenchmarkVelocity: XCUIGestureVelocity = 200_000

    // Keep four seconds of Inbox baseline. The dashboard omits the first two
    // seconds of profiler warm-up and retains two stable seconds before tap.
    sleep(4)
    reportRow.tap()

    let composer = targetApp.textViews["composer"]
    XCTAssertTrue(
      composer.waitForExistence(timeout: 30),
      "The benchmark app did not render #qddx"
    )
    sleep(3)

    stressReportActionsList(
      from: towardOlderStart,
      to: towardOlderEnd,
      benchmarkVelocity: benchmarkVelocity,
      fasterBenchmarkVelocity: fasterBenchmarkVelocity
    )
    stressReportActionsList(
      from: towardOlderEnd,
      to: towardOlderStart,
      benchmarkVelocity: benchmarkVelocity,
      fasterBenchmarkVelocity: fasterBenchmarkVelocity
    )
  }

  @MainActor
  private func stressReportActionsList(
    from start: XCUICoordinate,
    to end: XCUICoordinate,
    benchmarkVelocity: XCUIGestureVelocity,
    fasterBenchmarkVelocity: XCUIGestureVelocity
  ) {
    performReportActionsListSwipes(
      from: start,
      to: end,
      velocity: benchmarkVelocity,
      count: 2,
      interSwipeDelay: 0.2
    )
    sleep(2)
    performReportActionsListSwipes(
      from: start,
      to: end,
      velocity: fasterBenchmarkVelocity,
      count: 2,
      interSwipeDelay: 0.2
    )
    sleep(2)
    performReportActionsListSwipes(
      from: start,
      to: end,
      velocity: fasterBenchmarkVelocity,
      count: 5,
      interSwipeDelay: 0.2
    )
    sleep(2)
  }

  @MainActor
  private func performReportActionsListSwipes(
    from start: XCUICoordinate,
    to end: XCUICoordinate,
    velocity: XCUIGestureVelocity,
    count: Int,
    interSwipeDelay: TimeInterval = 0
  ) {
    performReportActionsListSwipes(
      paths: [(start: start, end: end)],
      velocity: velocity,
      count: count,
      interSwipeDelay: interSwipeDelay
    )
  }

  @MainActor
  private func performReportActionsListSwipes(
    paths: [(start: XCUICoordinate, end: XCUICoordinate)],
    velocity: XCUIGestureVelocity,
    count: Int,
    interSwipeDelay: TimeInterval = 0
  ) {
    precondition(!paths.isEmpty)
    for index in 0..<count {
      let path = paths[index % paths.count]
      path.start.press(
        forDuration: 0.001,
        thenDragTo: path.end,
        withVelocity: velocity,
        thenHoldForDuration: 0.05
      )
      if index < count - 1 && interSwipeDelay > 0 {
        Thread.sleep(forTimeInterval: interSwipeDelay)
      }
    }
  }

  @MainActor
  private func prepareWarmReportActionsListInbox(_ targetApp: XCUIApplication) -> XCUIElement {
    continueAfterFailure = false
    targetApp.terminate()
    targetApp.launch()
    XCTAssertTrue(
      targetApp.wait(for: .runningForeground, timeout: 15),
      "The benchmark app did not reach the foreground"
    )

    // Relaunch can restore either Inbox or the previously open report.
    let backButton = targetApp.buttons["Back"]
    if backButton.waitForExistence(timeout: 3) {
      backButton.tap()
    }
    sleep(2)

    let reportRow = targetApp.buttons["2636639376691898"]
    XCTAssertTrue(
      reportRow.waitForExistence(timeout: 60),
      "The benchmark app did not open Inbox with #qddx visible"
    )
    return reportRow
  }

  @MainActor
  private func openWarmReportActionsList(_ targetApp: XCUIApplication) {
    let reportRow = prepareWarmReportActionsListInbox(targetApp)
    reportRow.tap()
    sleep(8)
  }

  @MainActor
  func testCommand() throws {
    if RunnerEnv.isTruthy("AGENT_DEVICE_RUNNER_NOOP_STARTUP") {
      NSLog("AGENT_DEVICE_RUNNER_NOOP_STARTUP=1")
      return
    }

    doneExpectation = expectation(description: "agent-device command handled")
    NSLog("AGENT_DEVICE_RUNNER_HEADLESS_STARTUP=1")
    let desiredPort = RunnerEnv.resolvePort()
    NSLog("AGENT_DEVICE_RUNNER_DESIRED_PORT=%d", desiredPort)
    listener = try makeRunnerListener(desiredPort: desiredPort)
    listener?.stateUpdateHandler = { [weak self] state in
      switch state {
      case .ready:
        NSLog("AGENT_DEVICE_RUNNER_LISTENER_READY")
        if let listenerPort = self?.listener?.port {
          NSLog("AGENT_DEVICE_RUNNER_PORT=%d", listenerPort.rawValue)
        } else {
          NSLog("AGENT_DEVICE_RUNNER_PORT_NOT_SET")
        }
      case .failed(let error):
        NSLog("AGENT_DEVICE_RUNNER_LISTENER_FAILED=%@", String(describing: error))
        self?.doneExpectation?.fulfill()
      default:
        break
      }
    }
    listener?.newConnectionHandler = { [weak self] conn in
      guard let self else { return }
      conn.start(queue: self.transportQueue)
      self.handle(connection: conn)
    }
    listener?.start(queue: transportQueue)
    let idleKeepaliveTimer = DispatchSource.makeTimerSource(queue: transportQueue)
    idleKeepaliveTimer.schedule(
      deadline: .now() + xctestIdleKeepaliveInterval,
      repeating: xctestIdleKeepaliveInterval
    )
    idleKeepaliveTimer.setEventHandler {
      NSLog("AGENT_DEVICE_RUNNER_IDLE_KEEPALIVE")
    }
    idleKeepaliveTimer.resume()
    defer {
      idleKeepaliveTimer.cancel()
    }

    guard let expectation = doneExpectation else {
      XCTFail("runner expectation was not initialized")
      return
    }
    NSLog("AGENT_DEVICE_RUNNER_WAITING")
    let result = XCTWaiter.wait(for: [expectation], timeout: 24 * 60 * 60)
    NSLog("AGENT_DEVICE_RUNNER_WAIT_RESULT=%@", String(describing: result))
    if result != .completed {
      XCTFail("runner wait ended with \(result)")
    }
  }

  private func makeRunnerListener(desiredPort: UInt16) throws -> NWListener {
    if desiredPort > 0, let port = NWEndpoint.Port(rawValue: desiredPort) {
      #if os(macOS)
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: port)
        return try NWListener(using: parameters)
      #else
        return try NWListener(using: .tcp, on: port)
      #endif
    }
    return try NWListener(using: .tcp)
  }
}
