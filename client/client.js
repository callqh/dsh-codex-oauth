window.__ModuleLoader__.load({
	id: "dsh-codex-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		_deepseek_ai_dsh_client_ui_primitives = __toESM(_deepseek_ai_dsh_client_ui_primitives, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		/** The Remote namespace, which is the host Service key. */
		const NAMESPACE = "codexAuth";
		/** The package name this contribution is attributed to in diagnostics. */
		const PACKAGE = "dsh-codex-oauth";
		/** The only parameter type this plugin sends: a string the human typed or chose. */
		const TEXT_SCHEMA = Object.freeze({ "~standard": Object.freeze({
			version: 1,
			vendor: "dsh-codex-oauth",
			validate: (value) => typeof value === "string" ? { value } : { issues: [{ message: "expected a string" }] }
		}) });
		/** The parameter codec for one endpoint's field, named the generated way. */
		function strictTextCodec(method, field) {
			return {
				mode: "strict",
				typeSymbol: `${PACKAGE}#${NAMESPACE}/${method}:${field}`,
				create: () => TEXT_SCHEMA
			};
		}
		/** The result codec every method here uses. See {@link SrcJsonCodec}. */
		const SRC_JSON_RESULT = Object.freeze({ mode: "src-json" });
		/**
		* Declare one unary method.
		* @param method - the host method name, and the endpoint's last segment.
		* @param parameters - its parameters, in signature order.
		* @returns the descriptor.
		*/
		function unary(method, parameters = []) {
			return {
				id: `${PACKAGE}#${NAMESPACE}/${method}`,
				service: NAMESPACE,
				namespace: NAMESPACE,
				method,
				invocation: { kind: "direct" },
				parameters: parameters.map((name) => ({
					name,
					wire: name,
					source: "json",
					codec: strictTextCodec(method, name)
				})),
				result: SRC_JSON_RESULT
			};
		}
		/** The five methods the host Service exports, in declaration order. */
		const CONTRIBUTION = Object.freeze({
			package: PACKAGE,
			descriptors: [
				unary("status"),
				unary("signIn"),
				unary("answer", ["value"]),
				unary("cancel"),
				unary("signOut")
			]
		});
		/**
		* Unwrap a Remote answer, or throw the host's own message.
		* @param response - what a method of {@link CodexApi} returned.
		* @returns the host's value.
		* @throws {Error} carrying the host's message when the call failed.
		*/
		function unwrap(response) {
			if (response.ok) return response.value;
			const message = response.error?.message;
			throw new Error(typeof message === "string" && message.length > 0 ? message : "与 Harness 主进程通信失败");
		}
		//#endregion
		//#region \0codex-css:src/client/CodexSignIn.module.css.mjs
		const css = ".NEjy1a_root{flex-direction:column;gap:10px;display:flex}.NEjy1a_head{align-items:center;gap:8px;min-height:24px;display:flex}.NEjy1a_title{color:var(--dsw-alias-label-primary);font-size:13px;line-height:22px}.NEjy1a_headSpacer{flex:1}.NEjy1a_body{flex-direction:column;gap:6px;display:flex}.NEjy1a_row{align-items:baseline;gap:8px;font-size:13px;line-height:22px;display:flex}.NEjy1a_label{color:var(--dsw-alias-label-tertiary);flex:none;min-width:56px}.NEjy1a_value{color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;min-width:0}.NEjy1a_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.NEjy1a_error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.NEjy1a_notice{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.NEjy1a_done{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-secondary));font-size:12px;line-height:18px}.NEjy1a_actions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.NEjy1a_device{flex-direction:column;gap:6px;display:flex}.NEjy1a_code{background:var(--dsw-alias-bg-module-platform,var(--dsw-alias-bg-layer-2));border:1px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);color:var(--dsw-alias-label-primary);letter-spacing:3px;align-self:flex-start;padding:6px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:20px;font-weight:600}.NEjy1a_link{color:var(--dsw-alias-brand-primary);overflow-wrap:anywhere;font-size:12px;text-decoration:none}.NEjy1a_link:hover{text-decoration:underline}.NEjy1a_choices{flex-direction:column;gap:6px;display:flex}.NEjy1a_choice{text-align:left;flex-direction:column;align-items:flex-start;gap:1px;display:flex}.NEjy1a_choiceHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.NEjy1a_answerRow{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.NEjy1a_answerRow>:first-child{flex:1;min-width:180px}.NEjy1a_spin{flex:none;animation:1s linear infinite NEjy1a_spin}@keyframes NEjy1a_spin{to{transform:rotate(360deg)}}";
		const tagId = "dsh-codex-oauth/CodexSignIn.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-codex-oauth";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var CodexSignIn_module_css_default = {
			"device": "NEjy1a_device",
			"row": "NEjy1a_row",
			"done": "NEjy1a_done",
			"body": "NEjy1a_body",
			"title": "NEjy1a_title",
			"error": "NEjy1a_error",
			"link": "NEjy1a_link",
			"choices": "NEjy1a_choices",
			"choiceHint": "NEjy1a_choiceHint",
			"value": "NEjy1a_value",
			"answerRow": "NEjy1a_answerRow",
			"label": "NEjy1a_label",
			"code": "NEjy1a_code",
			"choice": "NEjy1a_choice",
			"spin": "NEjy1a_spin",
			"headSpacer": "NEjy1a_headSpacer",
			"notice": "NEjy1a_notice",
			"root": "NEjy1a_root",
			"head": "NEjy1a_head",
			"hint": "NEjy1a_hint",
			"actions": "NEjy1a_actions"
		};
		//#endregion
		//#region src/client/CodexSignIn.tsx
		/**
		* The Codex sign-in card, rendered inside the `openai-codex` provider row on
		* the Models settings page.
		*
		* Everything it shows comes from one host call, `status()`, and it renders the
		* four states a user can be in: not signed in, signing in (which includes
		* whatever question the flow is currently asking), signed in, and unable to
		* sign in at all. It never holds a credential and never sees a token.
		*
		* The polling is deliberate and bounded: it runs only while an attempt is in
		* flight, at a little over a second, and stops the moment the flow settles.
		* The alternative — a stream or event channel — needs a hand-written
		* descriptor for a non-unary method, and a wrong descriptor there fails at
		* mount rather than at runtime, which is a worse trade for a flow whose whole
		* interactive window is a couple of minutes.
		*
		* @module dsh-codex-oauth/client/CodexSignIn
		*/
		/** How often a running attempt is re-read. Short enough to feel live. */
		const POLL_MS = 1200;
		/**
		* How often to look for the namespace, and how many times before giving up.
		*
		* The namespace is created in this same page, moments after `$mount` resolves,
		* so a couple of seconds is already generous. The budget is deliberately short:
		* a card stuck on "connecting" is the same silence the give-up state exists to
		* remove, and two seconds of it is a diagnostic rather than a hang.
		*/
		const CONNECT_MS = 250;
		const CONNECT_ATTEMPTS = 8;
		/** The phase an attempt is in, defaulted so the first render has one. */
		function phaseOf(status) {
			return status?.attempt.phase ?? "idle";
		}
		/**
		* Render the sign-in surface.
		* @param props - the mounted Remote namespace and the bound dictionary.
		* @returns the card.
		*/
		function CodexSignIn({ getApi, t }) {
			const [remote, setRemote] = (0, react.useState)("connecting");
			const [status, setStatus] = (0, react.useState)(null);
			const [flash, setFlash] = (0, react.useState)(null);
			const [answer, setAnswer] = (0, react.useState)("");
			const [copied, setCopied] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				console.info("[dsh-codex-oauth] card mounted in its settings section");
				return () => {
					mounted.current = false;
				};
			}, []);
			/**
			* Re-read the whole state. Never throws at the caller.
			* @returns the status, or null when the host is not reachable yet.
			*/
			const reload = (0, react.useCallback)(async () => {
				const api = getApi();
				if (api === void 0) {
					if (mounted.current) setRemote((phase) => phase === "missing" ? phase : "connecting");
					return null;
				}
				if (mounted.current) setRemote("ready");
				try {
					const next = unwrap(await api.status());
					if (mounted.current) setStatus(next);
					return next;
				} catch (error) {
					if (mounted.current) setFlash({
						tone: "error",
						text: messageOf(error)
					});
					return null;
				}
			}, [getApi]);
			(0, react.useEffect)(() => {
				if (remote !== "connecting") return void 0;
				let cancelled = false;
				let attempts = 0;
				let timer = null;
				const tick = async () => {
					const next = await reload();
					if (cancelled || next !== null) return;
					attempts += 1;
					if (attempts >= CONNECT_ATTEMPTS) {
						setRemote("missing");
						console.warn(`[dsh-codex-oauth] the ${NAMESPACE} Remote namespace never appeared`);
						return;
					}
					timer = setTimeout(() => {
						tick();
					}, CONNECT_MS);
				};
				tick();
				return () => {
					cancelled = true;
					if (timer !== null) clearTimeout(timer);
				};
			}, [remote, reload]);
			const phase = phaseOf(status);
			(0, react.useEffect)(() => {
				if (phase !== "running") return void 0;
				let cancelled = false;
				let timer = null;
				const tick = async () => {
					const next = await reload();
					if (cancelled) return;
					if (next === null) return;
					if (next.attempt.phase === "running") {
						timer = setTimeout(() => {
							tick();
						}, POLL_MS);
						return;
					}
					setBusy(false);
					if (next.attempt.phase === "authorized") setFlash({
						tone: "done",
						text: t("done")
					});
					else if (next.attempt.phase === "cancelled") setFlash({
						tone: "notice",
						text: t("cancelled")
					});
				};
				timer = setTimeout(() => {
					tick();
				}, POLL_MS);
				return () => {
					cancelled = true;
					if (timer !== null) clearTimeout(timer);
				};
			}, [
				phase,
				reload,
				t
			]);
			/** Run one host action, surfacing whatever it says. */
			const run = (0, react.useCallback)(async (action) => {
				const api = getApi();
				if (api === void 0) {
					setRemote("missing");
					return;
				}
				setBusy(true);
				setFlash(null);
				try {
					await action(api);
				} catch (error) {
					setFlash({
						tone: "error",
						text: messageOf(error)
					});
				} finally {
					if (mounted.current) setBusy(false);
				}
			}, [getApi]);
			const start = () => {
				opened.current = "";
				run(async (api) => {
					const attempt = unwrap(await api.signIn());
					setAnswer("");
					await reload();
					if (attempt.phase === "failed") setFlash({
						tone: "error",
						text: attempt.error ?? t("failed")
					});
				});
			};
			const send = (value) => {
				run(async (api) => {
					unwrap(await api.answer(value));
					setAnswer("");
					await reload();
				});
			};
			const cancel = () => {
				run(async (api) => {
					unwrap(await api.cancel());
					setFlash({
						tone: "notice",
						text: t("cancelled")
					});
					await reload();
				});
			};
			const signOut = () => {
				if (!window.confirm(t("signOutConfirm"))) return;
				run(async (api) => {
					setStatus(unwrap(await api.signOut()));
					setFlash(null);
				});
			};
			/** Copy one string, marking which control did it for the acknowledgement. */
			const copy = (0, react.useCallback)((what, value) => {
				navigator.clipboard?.writeText(value).then(() => {
					if (!mounted.current) return;
					setCopied(what);
					setTimeout(() => {
						if (mounted.current) setCopied("");
					}, 1500);
				}).catch((error) => {
					if (mounted.current) setFlash({
						tone: "error",
						text: messageOf(error)
					});
				});
			}, []);
			const noticeUrl = status?.attempt.notice?.url ?? null;
			const noticeCode = status?.attempt.notice?.code ?? null;
			const opened = (0, react.useRef)("");
			(0, react.useEffect)(() => {
				if (noticeUrl === null || noticeCode !== null) return;
				if (opened.current === noticeUrl) return;
				opened.current = noticeUrl;
				try {
					window.open(noticeUrl, "_blank", "noopener,noreferrer");
				} catch {}
			}, [noticeUrl, noticeCode]);
			const signedIn = status?.signedIn === true;
			const running = phase === "running";
			const ready = status?.ready !== false;
			const canSignIn = ready && status?.flowAvailable === true;
			const attempt = status?.attempt ?? null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CodexSignIn_module_css_default.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CodexSignIn_module_css_default.head,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: CodexSignIn_module_css_default.title,
								children: t("title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: CodexSignIn_module_css_default.headSpacer }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: signedIn ? "done" : running ? "ongoing" : "idle" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: CodexSignIn_module_css_default.hint,
								children: running ? t("signingIn") : signedIn ? t("signedIn") : t("signedOut")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CodexSignIn_module_css_default.body,
						children: [
							remote === "missing" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: CodexSignIn_module_css_default.error,
								children: t("namespaceMissing")
							}) : status === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: CodexSignIn_module_css_default.hint,
								children: remote === "connecting" ? t("connecting") : t("checking")
							}) : !ready ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: CodexSignIn_module_css_default.error,
								children: t("seamsMissing")
							}) : signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CodexSignIn_module_css_default.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: CodexSignIn_module_css_default.label,
										children: t("account")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: CodexSignIn_module_css_default.value,
										children: status.accountId ?? t("unknown")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CodexSignIn_module_css_default.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: CodexSignIn_module_css_default.label,
										children: t("plan")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: CodexSignIn_module_css_default.value,
										children: planLabel(status.planType, t)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CodexSignIn_module_css_default.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: CodexSignIn_module_css_default.label,
										children: t("expires")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: CodexSignIn_module_css_default.value,
										children: timeLabel(status.expiresAt, t)
									})]
								})
							] }) : running && attempt !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AttemptBody, {
								attempt,
								t,
								onCopy: copy,
								copied,
								answer,
								onAnswerChange: setAnswer,
								onSend: send,
								busy
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: CodexSignIn_module_css_default.hint,
								children: status.flowAvailable ? t("signInHint") : t("flowMissing")
							}),
							status !== null && status.routeConfigured === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CodexSignIn_module_css_default.error,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("routeMissingTitle") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}),
									t("routeMissing")
								]
							}) : null,
							phase === "failed" && attempt?.error != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: CodexSignIn_module_css_default.error,
								children: `${t("failed")}：${attempt.error}`
							}) : null,
							flash === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: flash.tone === "error" ? CodexSignIn_module_css_default.error : flash.tone === "done" ? CodexSignIn_module_css_default.done : CodexSignIn_module_css_default.notice,
								children: flash.text
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CodexSignIn_module_css_default.actions,
						children: [!ready || remote !== "ready" ? null : signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							disabled: busy,
							onClick: signOut,
							children: t("signOut")
						}) : running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							disabled: busy,
							onClick: cancel,
							children: t("cancel")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							disabled: busy || !canSignIn,
							icon: busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutlineRegular, {
								size: 16,
								className: CodexSignIn_module_css_default.spin
							}) : void 0,
							onClick: start,
							children: busy ? t("working") : t("signIn")
						}), !running && !signedIn && ready && remote === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							disabled: busy,
							onClick: () => {
								reload();
							},
							children: t("retry")
						}) : null]
					})
				]
			});
		}
		/** The body of a running attempt: what the flow last said, and what it asks. */
		function AttemptBody(props) {
			const { attempt, t, answer, busy, copied, onCopy, onAnswerChange, onSend } = props;
			const notice = attempt.notice;
			const prompt = attempt.prompt;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [notice?.code != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CodexSignIn_module_css_default.device,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CodexSignIn_module_css_default.hint,
						children: notice.message.length > 0 ? notice.message : t("stepInBrowser")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
						className: CodexSignIn_module_css_default.code,
						children: notice.code
					}),
					notice.url === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						className: CodexSignIn_module_css_default.link,
						href: notice.url,
						target: "_blank",
						rel: "noreferrer",
						children: notice.url
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CodexSignIn_module_css_default.actions,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 16 }),
							onClick: () => onCopy("code", notice.code ?? ""),
							children: copied === "code" ? t("copied") : t("copyCode")
						})
					})
				]
			}) : notice?.url != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CodexSignIn_module_css_default.device,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CodexSignIn_module_css_default.hint,
					children: t("browserOpening")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: CodexSignIn_module_css_default.actions,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						className: CodexSignIn_module_css_default.link,
						href: notice.url,
						target: "_blank",
						rel: "noreferrer",
						children: t("openPage")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						size: "sm",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineRegular, { size: 16 }),
						onClick: () => onCopy("link", notice.url ?? ""),
						children: copied === "link" ? t("copied") : t("copyLink")
					})]
				})]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: CodexSignIn_module_css_default.hint,
				children: notice?.message != null && notice.message.length > 0 ? notice.message : t("signingIn")
			}), prompt === null ? null : prompt.kind === "select" && prompt.options !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CodexSignIn_module_css_default.choices,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CodexSignIn_module_css_default.hint,
					children: prompt.message
				}), prompt.options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					disabled: busy,
					className: CodexSignIn_module_css_default.choice,
					onClick: () => onSend(option.id),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: option.label }), option.description === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CodexSignIn_module_css_default.choiceHint,
						children: option.description
					})]
				}, option.id))]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CodexSignIn_module_css_default.choices,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CodexSignIn_module_css_default.hint,
					children: prompt.message
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
					className: CodexSignIn_module_css_default.answerRow,
					onSubmit: (event) => {
						event.preventDefault();
						onSend(answer);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						type: prompt.kind === "secret" ? "password" : "text",
						value: answer,
						placeholder: prompt.placeholder ?? "",
						"aria-label": prompt.message,
						onChange: (event) => onAnswerChange(event.target.value)
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						type: "submit",
						variant: "outline",
						size: "sm",
						disabled: busy,
						children: t("submit")
					})]
				})]
			})] });
		}
		/**
		* The two tiers the subscription copy names, so they read as products.
		*
		* Everything else is deliberately not translated: those values are the
		* vendor's own tier identifiers, and putting a localised product name on one
		* would be inventing a plan that may not exist.
		*/
		const PLAN_MESSAGE = {
			plus: "planPlus",
			pro: "planPro"
		};
		/**
		* The plan tier, as something a person can read.
		*
		* The claim is an internal identifier — `self_serve_business_prolite` is a real
		* one — and printing it verbatim makes a working card look broken. Known tiers
		* get their product name; the rest are formatted from the identifier itself
		* (separators to spaces, words capitalised), which is presentation, not a claim
		* about what the plan is called.
		*/
		function planLabel(planType, t) {
			if (planType === null) return t("unknown");
			const message = PLAN_MESSAGE[planType];
			if (message !== void 0) return t(message);
			return planType.split(/[_-]+/).filter((word) => word.length > 0).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
		}
		/** An absolute expiry, or "unknown" when the grant carried none. */
		function timeLabel(expiresAt, t) {
			if (expiresAt === null || expiresAt <= 0) return t("unknown");
			return new Date(expiresAt).toLocaleString();
		}
		/** The message of a caught value, whatever it turned out to be. */
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* The host module's members this card renders.
		*
		* They arrive through the page's platform seed table rather than through a
		* package this bundle can check at build time, so a host that renamed or
		* dropped one would hand the card an `undefined` component and the throw would
		* blank the whole settings dialog. The entry checks this list first and skips
		* registration instead — the card going missing is a smaller failure than the
		* page going missing.
		*/
		const REQUIRED_PRIMITIVES = [
			"Button",
			"Input",
			"StateDot",
			"IconCopyOutlineRegular",
			"IconLinkOutlineRegular",
			"IconLoadingOutlineRegular"
		];
		//#endregion
		//#region src/client/ErrorBoundary.tsx
		/**
		* Keep one throwing card from taking the settings dialog with it.
		*
		* A slot entry's component is rendered by the host's own tree, so an exception
		* during render propagates into the dialog that owns the slot and the user
		* loses the whole page — not just this card. The boundary is deliberately the
		* smallest thing that can work: it renders the failure in place, in the
		* card's own words, and offers nothing it cannot deliver.
		*
		* @module dsh-codex-oauth/client/ErrorBoundary
		*/
		/**
		* Render `children`, or the failure that replaced them.
		*
		* React only routes render-time throws to the nearest boundary in the same
		* tree; this is that boundary for one card, and it is per-entry so a broken
		* Codex card cannot affect any other provider's row.
		*/
		var CardErrorBoundary = class extends react.Component {
			state = { message: null };
			/**
			* @param error - what the subtree threw.
			* @returns the state that replaces the subtree.
			*/
			static getDerivedStateFromError(error) {
				return { message: error instanceof Error ? error.message : String(error) };
			}
			/**
			* Report the failure where a developer can see it.
			* @param error - what the subtree threw.
			* @param info - React's component stack.
			*/
			componentDidCatch(error, info) {
				console.warn("[dsh-codex-oauth] the Codex sign-in card failed to render", error, info.componentStack);
			}
			/**
			* @returns the card, or its failure notice.
			*/
			render() {
				const { labels, children } = this.props;
				const { message } = this.state;
				if (message === null) return children;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: CodexSignIn_module_css_default.root,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CodexSignIn_module_css_default.error,
						children: `${labels.title}：${message}`
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CodexSignIn_module_css_default.actions,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: CodexSignIn_module_css_default.hint,
							onClick: () => this.setState({ message: null }),
							children: labels.retry
						})
					})]
				});
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/**
		* The card's two dictionaries.
		*
		* Written to one rule: every line has to answer "so what?". A state says what
		* is true, a failure says what happened and what to do about it, and anything
		* a user cannot act on does not appear at all. The one exception is the
		* advanced note about the profile route, which is only rendered when the host
		* actually reports the route missing — a state the user can fix.
		*
		* @module dsh-codex-oauth/client/locales
		*/
		/** The locale namespace this plugin registers its dictionaries under. */
		const NS = "codex-oauth";
		const zh = {
			nav: "Codex 登录",
			title: "OpenAI Codex",
			subtitle: "ChatGPT Plus / Pro 订阅",
			signedIn: "已登录",
			signedOut: "未登录",
			account: "账号",
			plan: "套餐",
			expires: "登录有效期至",
			unknown: "未知",
			planPlus: "Plus",
			planPro: "Pro",
			signIn: "使用 ChatGPT 账号登录",
			signInHint: "用已有的 ChatGPT 订阅登录，不需要 API Key。",
			signingIn: "等待浏览器完成登录…",
			stepInBrowser: "在浏览器里打开下面的地址，输入设备代码：",
			openPage: "打开授权页面",
			copyCode: "复制代码",
			copyLink: "复制链接",
			copied: "已复制",
			browserOpening: "授权页面会在新标签页打开。如果没有自动打开，点下面的链接，或复制后手动打开。",
			submit: "提交",
			cancel: "取消登录",
			signOut: "退出登录",
			signOutConfirm: "退出后需要重新登录才能继续使用 Codex 模型。确定退出吗？",
			checking: "正在读取登录状态…",
			connecting: "正在连接 Harness…",
			namespaceMissing: "连不上 Harness 的登录服务（codexAuth）。插件已加载，但主进程没有把接口挂上——请把控制台里 [dsh-codex-oauth] 开头的日志发出来。",
			working: "处理中…",
			done: "登录成功。Codex 模型现在可以使用了。",
			cancelled: "已取消登录，没有产生任何凭证。",
			failed: "登录没有完成",
			seamsMissing: "Harness 的授权或凭证服务没有挂载，这台机器上无法完成登录。",
			flowMissing: "当前的 Harness 版本没有为 Codex 注册登录入口，无法发起登录。这通常意味着 llm-pi-ai 未挂载，或它的目录里没有 openai-codex。",
			routeMissingTitle: "Codex 路由尚未在配置里声明",
			routeMissing: "登录本身可以完成，但 Harness 还不会把请求发给 Codex——profile 里缺少 llm-pi-ai 的 providers[\"openai-codex\"]。在「模型」设置里添加该供应商（留空即用订阅登录，不需要 API Key），然后回到这里。",
			retry: "重试"
		};
		const en = {
			nav: "Codex sign-in",
			title: "OpenAI Codex",
			subtitle: "ChatGPT Plus / Pro subscription",
			signedIn: "Signed in",
			signedOut: "Not signed in",
			account: "Account",
			plan: "Plan",
			expires: "Sign-in valid until",
			unknown: "Unknown",
			planPlus: "Plus",
			planPro: "Pro",
			signIn: "Sign in with ChatGPT",
			signInHint: "Uses the ChatGPT subscription you already have. No API key needed.",
			signingIn: "Waiting for the browser to finish…",
			stepInBrowser: "Open this address in your browser and enter the device code:",
			openPage: "Open authorization page",
			copyCode: "Copy code",
			copyLink: "Copy link",
			copied: "Copied",
			browserOpening: "The authorization page opens in a new tab. If it did not, use the link below or copy it.",
			submit: "Submit",
			cancel: "Cancel sign-in",
			signOut: "Sign out",
			signOutConfirm: "After signing out you will need to sign in again to use Codex models. Sign out?",
			checking: "Reading sign-in state…",
			connecting: "Connecting to Harness…",
			namespaceMissing: "Cannot reach the Harness sign-in service (codexAuth). The plugin loaded, but the host did not publish the interface — please share the console lines starting with [dsh-codex-oauth].",
			working: "Working…",
			done: "Signed in. Codex models are ready to use.",
			cancelled: "Sign-in cancelled. Nothing was stored.",
			failed: "Sign-in did not finish",
			seamsMissing: "This Harness has no authorization or credential service mounted, so signing in is not possible here.",
			flowMissing: "This Harness build registered no sign-in flow for Codex, so one cannot be started. That usually means llm-pi-ai is not mounted, or its catalog ships no openai-codex.",
			routeMissingTitle: "The Codex route is not declared yet",
			routeMissing: "Signing in will work, but Harness still will not route requests to Codex: the profile declares no providers[\"openai-codex\"] for llm-pi-ai. Add that provider in Models settings (leave it empty — the subscription sign-in needs no API key), then come back.",
			retry: "Retry"
		};
		/**
		* Bind one dictionary lookup to a locale service.
		*
		* The service's own `bind` returns a function typed against an open string
		* key; this narrows it so a typo in a key is caught at build time instead.
		* @param bind - the dictionary lookup the locale service returned.
		* @returns a lookup restricted to {@link MessageKey}.
		*/
		function bindMessages(bind) {
			return (key) => bind(key);
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* dsh-codex-oauth — browser entry.
		*
		* ## The seat
		*
		* The card is its own `settings.section`, so it appears in the settings sidebar
		* as **Codex sign-in**.
		*
		* It was first written into `settings.models.provider-card`, the keyed slot the
		* Models page renders inside each provider row. That seat is contextually right
		* and was rejected on contact with a user: those rows are the API-key editor,
		* and a subscription sign-in sitting inside one reads as part of that editor —
		* as if the ChatGPT login were an alternative way to fill in the same field. It
		* is not; it is a different thing that happens to configure the same route.
		*
		* The section seat also drops a whole class of silent failure. The provider-card
		* seat is keyed by the row's `settingsNs` (`llm-pi-ai`, derived from the loader
		* entry id), so a profile that renames that row loses the card with no error
		* anywhere; and the row itself only exists once the route is declared. A
		* section is declared by the shell and keyed by nothing.
		*
		* One host-contract fact this file still depends on:
		*
		* - The page's module table — not a package this bundle could depend on — is
		*   where `@deepseek-ai/dsh-client-ui-primitives` comes from (it is one of the
		*   platform seed words). The gate below turns a host that renamed one of the
		*   primitives into a missing card instead of a blank settings dialog.
		*
		* ## Why registration does not wait for the Remote namespace
		*
		* The first version nested the slot registration inside
		* `ctx.inject(['remote.codexAuth'], …)`, so nothing was registered until
		* `$mount` had resolved and the namespace service existed. That is one async
		* step too many in front of the only thing the user can see: if the mount fails
		* — for any reason, including one this plugin has not anticipated — the plugin
		* produces no card, no entry and no explanation. Silence is indistinguishable
		* from "not installed", and it is the worst available outcome.
		*
		* Registration now depends only on `slots` and `locale`, both declared in
		* `inject` above. The card resolves the namespace lazily through `ctx.get` and
		* says what it is waiting for while it does, so every failure has a visible
		* shape. The breadcrumbs below exist for the same reason: they make the console
		* answer "did this bundle even run".
		*
		* @module dsh-codex-oauth/client
		*/
		/** This plugin's own name. Also the prefix of every line this file logs. */
		const name = "codex-oauth";
		/** Prefix for the breadcrumbs; grepping the console for it finds all of them. */
		const TAG = "[dsh-codex-oauth]";
		const inject = [
			"slots",
			"locale",
			"remote"
		];
		/** The slot: one page in the settings sidebar. */
		const SLOT = "settings.section";
		/** This section's id, and the order it takes among the built-in sections. */
		const SECTION_ID = "codex-oauth";
		const SECTION_ORDER = 14;
		/**
		* Register the card.
		* @param ctx - the client context carrying the slots, locale and remote seams.
		*/
		function apply(ctx) {
			console.info(`${TAG} client apply`);
			const missing = missingPrimitives(_deepseek_ai_dsh_client_ui_primitives);
			if (missing.length > 0) {
				console.warn(`${TAG} this host's ui-primitives module is missing ${missing.join(", ")}; the Codex sign-in card is disabled rather than allowed to blank the settings dialog`);
				return;
			}
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "codex-oauth: dictionaries");
			const lookup = ctx.locale.bind(NS);
			const t = bindMessages(lookup);
			ctx.effect(() => {
				let dispose;
				let unloaded = false;
				ctx.remote.$mount(CONTRIBUTION).then((off) => {
					console.info(`${TAG} Remote namespace ${JSON.stringify(NAMESPACE)} mounted`);
					if (unloaded) off();
					else dispose = off;
				}).catch((error) => {
					console.warn(`${TAG} could not mount the ${NAMESPACE} Remote namespace`, error);
				});
				return async () => {
					unloaded = true;
					await dispose?.();
				};
			}, "codex-oauth: Remote contribution");
			ctx.slots.inject(SLOT, () => {
				console.info(`${TAG} slot ${JSON.stringify(SLOT)} is declared; adding the ${SECTION_ID} section`);
				return ctx.slots.register({
					name: SLOT,
					id: SECTION_ID,
					order: SECTION_ORDER,
					label: () => lookup("nav"),
					locale: NS,
					inject: () => ({ t: lookup })
				}, () => (0, react.createElement)(CardErrorBoundary, { labels: {
					title: t("failed"),
					retry: t("retry")
				} }, (0, react.createElement)(CodexSignIn, {
					getApi: () => ctx.get(`remote.${NAMESPACE}`),
					t
				})));
			});
		}
		/**
		* Which primitives this bundle renders that the host module does not export.
		* @param mod - the host's ui-primitives module.
		* @returns the missing member names, empty when the host is compatible.
		*/
		function missingPrimitives(mod, required = REQUIRED_PRIMITIVES) {
			return required.filter((member) => mod[member] === void 0);
		}
		//#endregion
		exports.REQUIRED_PRIMITIVES = REQUIRED_PRIMITIVES;
		exports.apply = apply;
		exports.inject = inject;
		exports.missingPrimitives = missingPrimitives;
		exports.name = name;
		return module.exports;
	}
});
