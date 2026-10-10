package com.toush.sketchdraw

import android.graphics.Color
import android.graphics.Path
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.ink.authoring.InProgressStrokeId
import androidx.ink.authoring.InProgressStrokesFinishedListener
import androidx.ink.authoring.InProgressStrokesView
import androidx.ink.brush.Brush
import androidx.ink.brush.SelfOverlap
import androidx.ink.brush.StockBrushes
import androidx.ink.strokes.Stroke
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Native low-latency preview for Android stylus input. The WebView remains the
 * source of committed strokes; this view only renders the wet stroke and sends
 * native MotionEvent samples to the existing canvas point collector.
 */
internal object AndroidStylusInkController {
  private var inkView: InProgressStrokesView? = null
  private var activity: MainActivity? = null
  private var config = StylusPreviewConfigArgs()
  private var activePointerId = -1
  private var activeStrokeId: InProgressStrokeId? = null
  private val density: Float
    get() = activity?.resources?.displayMetrics?.density ?: 1f

  private val finishedListener = object : InProgressStrokesFinishedListener {
    override fun onStrokesFinished(strokes: Map<InProgressStrokeId, Stroke>) {
      val finishedIds = strokes.keys.toSet()
      val view = inkView ?: return
      // The WebView's normal pointer path commits the same stroke to the canvas.
      // The WebView commits the matching stroke in the same pointer-up dispatch.
      // Keep the front-buffered copy for one frame, then clear it to prevent doubled tips.
      view.postDelayed({ inkView?.removeFinishedStrokes(finishedIds) }, 32L)
    }
  }

  fun attach(mainActivity: MainActivity) {
    if (activity === mainActivity && inkView != null) return
    detach()
    val content = mainActivity.findViewById<ViewGroup>(android.R.id.content) ?: return
    val overlay = InProgressStrokesView(mainActivity).apply {
      isClickable = false
      isFocusable = false
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      addFinishedStrokesListener(finishedListener)
      eagerInit()
    }
    content.addView(
      overlay,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )
    activity = mainActivity
    inkView = overlay
    overlay.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> updateMask() }
    overlay.post { updateMask() }
  }

  fun detach() {
    cancelActiveStroke(null)
    inkView?.removeFinishedStrokesListener(finishedListener)
    (inkView?.parent as? ViewGroup)?.removeView(inkView)
    inkView = null
    activity = null
  }

  fun configure(mainActivity: MainActivity, next: StylusPreviewConfigArgs) {
    if (activity !== mainActivity || inkView == null) attach(mainActivity)
    val wasEnabled = config.enabled
    config = next
    if (!next.enabled && wasEnabled) cancelActiveStroke(null)
    updateMask()
  }

  fun onMotionEvent(mainActivity: MainActivity, event: MotionEvent) {
    if (activity !== mainActivity || inkView == null) return
    if (event.actionMasked == MotionEvent.ACTION_CANCEL) {
      cancelActiveStroke(event)
      return
    }

    val pointerIndex = when (event.actionMasked) {
      MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> event.actionIndex
      else -> if (activePointerId >= 0) event.findPointerIndex(activePointerId) else -1
    }

    if (activePointerId < 0) {
      if (!config.enabled || event.actionMasked !in setOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN) || pointerIndex < 0) return
      if (event.getToolType(pointerIndex) != MotionEvent.TOOL_TYPE_STYLUS || !isInsideCanvas(event, pointerIndex)) return
      startStroke(event, pointerIndex)
      return
    }

    val trackedIndex = event.findPointerIndex(activePointerId)
    if (trackedIndex < 0) return
    when (event.actionMasked) {
      MotionEvent.ACTION_MOVE -> {
        val view = inkView ?: return
        val strokeId = activeStrokeId ?: return
        val inkEvent = eventForInkView(event)
        try {
          view.addToStroke(inkEvent, activePointerId, strokeId, null)
        } finally {
          inkEvent.recycle()
        }
        dispatchCapturedSamples(event, trackedIndex)
      }
      MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP -> {
        if (event.getPointerId(event.actionIndex) != activePointerId) return
        dispatchCapturedSamples(event, trackedIndex)
        finishStroke(event)
      }
      MotionEvent.ACTION_POINTER_DOWN -> Unit // A resting finger does not take over the S Pen stroke.
    }
  }

  private fun startStroke(event: MotionEvent, pointerIndex: Int) {
    val view = inkView ?: return
    val mainActivity = activity ?: return
    val pointerId = event.getPointerId(pointerIndex)
    mainActivity.window.decorView.requestUnbufferedDispatch(event)
    val inkEvent = eventForInkView(event)
    try {
      val widthPx = (config.thickness * config.zoom * density).coerceIn(0.5f, 256f)
      val brushColor = try {
        val color = Color.parseColor(config.color ?: "#202124")
        Color.argb((Color.alpha(color) * config.opacity.coerceIn(0f, 1f)).roundToInt(), Color.red(color), Color.green(color), Color.blue(color))
      } catch (_: Exception) {
        Color.BLACK
      }
      val family = when {
        config.brushMode == "highlighter" -> StockBrushes.highlighter(SelfOverlap.DISCARD)
        !config.pressureEnabled -> StockBrushes.marker()
        config.brushMode == "marker" || config.brushMode == "brush" -> StockBrushes.marker()
        else -> StockBrushes.pressurePen()
      }
      val brush = Brush.createWithColorIntArgb(family, brushColor, widthPx, (0.25f * density).coerceAtLeast(0.1f))
      activePointerId = pointerId
      activeStrokeId = view.startStroke(inkEvent, pointerId, brush)
      dispatchCapturedSamples(event, pointerIndex)
    } catch (_: Exception) {
      activePointerId = -1
      activeStrokeId = null
    } finally {
      inkEvent.recycle()
    }
  }

  private fun finishStroke(event: MotionEvent) {
    val view = inkView
    val pointerId = activePointerId
    val strokeId = activeStrokeId
    if (view != null && pointerId >= 0 && strokeId != null) {
      val inkEvent = eventForInkView(event)
      try {
        view.finishStroke(inkEvent, pointerId, strokeId)
      } catch (_: Exception) {
        view.cancelStroke(strokeId, inkEvent)
      } finally {
        inkEvent.recycle()
      }
    }
    activePointerId = -1
    activeStrokeId = null
  }

  private fun cancelActiveStroke(event: MotionEvent?) {
    val view = inkView
    val pointerId = activePointerId
    val strokeId = activeStrokeId
    if (view != null && pointerId >= 0 && strokeId != null) {
      if (event != null && event.findPointerIndex(pointerId) >= 0) {
        val inkEvent = eventForInkView(event)
        try { view.cancelStroke(strokeId, inkEvent) } catch (_: Exception) { view.cancelStroke(strokeId) } finally { inkEvent.recycle() }
      } else {
        try { view.cancelStroke(strokeId) } catch (_: Exception) { /* The view may already have canceled this pointer. */ }
      }
    }
    activePointerId = -1
    activeStrokeId = null
  }

  private fun eventForInkView(event: MotionEvent): MotionEvent {
    val mainActivity = activity
    val target = inkView
    if (mainActivity == null || target == null) return MotionEvent.obtain(event)
    val sourceLocation = IntArray(2)
    val targetLocation = IntArray(2)
    mainActivity.window.decorView.getLocationOnScreen(sourceLocation)
    target.getLocationOnScreen(targetLocation)
    return MotionEvent.obtain(event).apply {
      offsetLocation((sourceLocation[0] - targetLocation[0]).toFloat(), (sourceLocation[1] - targetLocation[1]).toFloat())
    }
  }

  private fun isInsideCanvas(event: MotionEvent, pointerIndex: Int): Boolean {
    val client = clientPosition(event.getX(pointerIndex), event.getY(pointerIndex)) ?: return false
    return client.first >= config.canvasLeft && client.first <= config.canvasLeft + config.canvasWidth &&
      client.second >= config.canvasTop && client.second <= config.canvasTop + config.canvasHeight
  }

  private fun clientPosition(localX: Float, localY: Float): Pair<Float, Float>? {
    val mainActivity = activity ?: return null
    val rootLocation = IntArray(2)
    val webViewLocation = IntArray(2)
    mainActivity.window.decorView.getLocationOnScreen(rootLocation)
    (findWebView(mainActivity.window.decorView) ?: mainActivity.window.decorView).getLocationOnScreen(webViewLocation)
    val screenX = rootLocation[0] + localX
    val screenY = rootLocation[1] + localY
    return Pair((screenX - webViewLocation[0]) / density, (screenY - webViewLocation[1]) / density)
  }

  private fun dispatchCapturedSamples(event: MotionEvent, pointerIndex: Int) {
    val mainActivity = activity ?: return
    val webView = findWebView(mainActivity.window.decorView) ?: return
    if (pointerIndex !in 0 until event.pointerCount) return
    val samples = JSONArray()
    for (historyIndex in 0 until event.historySize) {
      appendSample(samples, event, pointerIndex, historyIndex)
    }
    appendSample(samples, event, pointerIndex, null)
    if (samples.length() == 0) return
    webView.evaluateJavascript("window.__sketchDrawReceiveAndroidStylusSamples?.($samples)", null)
  }

  private fun appendSample(samples: JSONArray, event: MotionEvent, pointerIndex: Int, historyIndex: Int?) {
    val x = if (historyIndex == null) event.getX(pointerIndex) else event.getHistoricalX(pointerIndex, historyIndex)
    val y = if (historyIndex == null) event.getY(pointerIndex) else event.getHistoricalY(pointerIndex, historyIndex)
    val client = clientPosition(x, y) ?: return
    val pressure = if (historyIndex == null) event.getAxisValue(MotionEvent.AXIS_PRESSURE, pointerIndex) else event.getHistoricalAxisValue(MotionEvent.AXIS_PRESSURE, pointerIndex, historyIndex)
    val tilt = if (historyIndex == null) event.getAxisValue(MotionEvent.AXIS_TILT, pointerIndex) else event.getHistoricalAxisValue(MotionEvent.AXIS_TILT, pointerIndex, historyIndex)
    val orientation = if (historyIndex == null) event.getAxisValue(MotionEvent.AXIS_ORIENTATION, pointerIndex) else event.getHistoricalAxisValue(MotionEvent.AXIS_ORIENTATION, pointerIndex, historyIndex)
    val tiltDegrees = (tilt.takeIf { it.isFinite() } ?: 0f).coerceIn(0f, (PI / 2).toFloat()) * 180f / PI.toFloat()
    val orientationRadians = orientation.takeIf { it.isFinite() } ?: 0f
    val orientationDegrees = ((orientationRadians * 180f / PI.toFloat()) % 360f + 360f) % 360f
    val time = if (historyIndex == null) event.eventTime.toDouble() else event.getHistoricalEventTime(historyIndex).toDouble()
    val phase = when (event.actionMasked) {
      MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> "start"
      MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> "end"
      else -> "move"
    }
    samples.put(
      JSONObject()
        .put("clientX", client.first.toDouble())
        .put("clientY", client.second.toDouble())
        .put("pressure", (pressure.takeIf { it.isFinite() } ?: 0f).coerceIn(0f, 1f).toDouble())
        .put("tiltX", (tiltDegrees * cos(orientationRadians)).toDouble())
        .put("tiltY", (tiltDegrees * sin(orientationRadians)).toDouble())
        .put("orientation", orientationDegrees.toDouble())
        .put("time", time)
        .put("phase", phase),
    )
  }

  private fun updateMask() {
    val view = inkView ?: return
    val mainActivity = activity ?: return
    if (view.width <= 0 || view.height <= 0) return
    if (!config.enabled || config.canvasWidth <= 0f || config.canvasHeight <= 0f) {
      view.maskPath = null
      return
    }
    val webViewLocation = IntArray(2)
    val inkLocation = IntArray(2)
    (findWebView(mainActivity.window.decorView) ?: mainActivity.window.decorView).getLocationOnScreen(webViewLocation)
    view.getLocationOnScreen(inkLocation)
    val left = webViewLocation[0] + config.canvasLeft * density - inkLocation[0]
    val top = webViewLocation[1] + config.canvasTop * density - inkLocation[1]
    val right = left + config.canvasWidth * density
    val bottom = top + config.canvasHeight * density
    val mask = Path()
    mask.addRect(0f, 0f, view.width.toFloat(), top.coerceIn(0f, view.height.toFloat()), Path.Direction.CW)
    mask.addRect(0f, bottom.coerceIn(0f, view.height.toFloat()), view.width.toFloat(), view.height.toFloat(), Path.Direction.CW)
    mask.addRect(0f, top.coerceIn(0f, view.height.toFloat()), left.coerceIn(0f, view.width.toFloat()), bottom.coerceIn(0f, view.height.toFloat()), Path.Direction.CW)
    mask.addRect(right.coerceIn(0f, view.width.toFloat()), top.coerceIn(0f, view.height.toFloat()), view.width.toFloat(), bottom.coerceIn(0f, view.height.toFloat()), Path.Direction.CW)
    view.maskPath = mask
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        val found = findWebView(view.getChildAt(index))
        if (found != null) return found
      }
    }
    return null
  }
}
