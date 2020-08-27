import * as vscode from 'vscode'
import { checkSplitPanels, calculateRange } from './utils'
import { OnOffState, ModeState, AllStates } from './states'

export function activate(context: vscode.ExtensionContext) {
	let scrollingTask: NodeJS.Timeout
	let scrollingEditor: vscode.TextEditor | null
	let correspondingLinesHighlight :vscode.TextEditorDecorationType | undefined
	const scrolledEditorsQueue: Set<vscode.TextEditor> = new Set()
	const offsetByEditors: Map<vscode.TextEditor, number> = new Map()
	const reset = () => {
		offsetByEditors.clear()
		scrolledEditorsQueue.clear()
		scrollingEditor = null
		clearTimeout(scrollingTask)
		correspondingLinesHighlight?.dispose()
	}

	const onOffState = new OnOffState(context)
	const modeState = new ModeState(context)

	// Register disposables
	context.subscriptions.push(
		onOffState.registerCommand(() => {
			reset()
		}),
		modeState.registerCommand(() => {
			reset()
		}),
		vscode.window.onDidChangeVisibleTextEditors(textEditors => {
			AllStates.areVisible = checkSplitPanels(textEditors)
			reset()
		}),
		vscode.window.onDidChangeTextEditorVisibleRanges(({ textEditor, visibleRanges }) => {
			if (!AllStates.areVisible || onOffState.isOff() || textEditor.viewColumn === undefined) {
				return
			}
			if (scrollingEditor !== textEditor) {
				if (scrolledEditorsQueue.has(textEditor)) {
					scrolledEditorsQueue.delete(textEditor)
					return
				}
				scrollingEditor = textEditor
				if (modeState.isOffsetMode()) {
					vscode.window.visibleTextEditors
						.filter(editor => editor !== textEditor)
						.forEach(scrolledEditor => {
							offsetByEditors.set(scrolledEditor, scrolledEditor.visibleRanges[0].start.line - textEditor.visibleRanges[0].start.line)
						})
				} else {
					offsetByEditors.clear()
				}
			}
			if (scrollingTask) {
				clearTimeout(scrollingTask)
			}
			scrollingTask = setTimeout(() => {
				vscode.window.visibleTextEditors
					.filter(editor => editor !== textEditor)
					.forEach(scrolledEditor => {
						scrolledEditorsQueue.add(scrolledEditor)
						scrolledEditor.revealRange(
							calculateRange(visibleRanges[0], offsetByEditors.get(scrolledEditor), textEditor, scrolledEditor),
							vscode.TextEditorRevealType.AtTop,
						)
					})
			}, 0)
		}),
		vscode.window.onDidChangeTextEditorSelection(({ selections, textEditor }) => {
			if (!AllStates.areVisible || onOffState.isOff() || textEditor.viewColumn === undefined) {
				return
			}
			correspondingLinesHighlight?.dispose()
			correspondingLinesHighlight = vscode.window.createTextEditorDecorationType({ backgroundColor: new vscode.ThemeColor('editor.inactiveSelectionBackground') })
			vscode.window.visibleTextEditors
				.filter(editor => editor !== textEditor)
				.forEach((scrolledEditor) => {
					scrolledEditor.setDecorations(
						correspondingLinesHighlight!,
						selections.map(selection => calculateRange(selection, offsetByEditors.get(scrolledEditor))),
					)
				})
		})
	)

	AllStates.init(checkSplitPanels())
}

export function deactivate() {}
