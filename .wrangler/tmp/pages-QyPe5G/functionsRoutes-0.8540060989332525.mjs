import { onRequestPost as __api_auth_logout_js_onRequestPost } from "/home/claude/roadmap/functions/api/auth/logout.js"
import { onRequestGet as __api_auth_me_js_onRequestGet } from "/home/claude/roadmap/functions/api/auth/me.js"
import { onRequestPost as __api_auth_start_js_onRequestPost } from "/home/claude/roadmap/functions/api/auth/start.js"
import { onRequestGet as __api_auth_verify_js_onRequestGet } from "/home/claude/roadmap/functions/api/auth/verify.js"
import { onRequestDelete as __api_routes__id__js_onRequestDelete } from "/home/claude/roadmap/functions/api/routes/[id].js"
import { onRequestGet as __api_routes__id__js_onRequestGet } from "/home/claude/roadmap/functions/api/routes/[id].js"
import { onRequestPut as __api_routes__id__js_onRequestPut } from "/home/claude/roadmap/functions/api/routes/[id].js"
import { onRequestDelete as __api_account_index_js_onRequestDelete } from "/home/claude/roadmap/functions/api/account/index.js"
import { onRequestPost as __api_account_index_js_onRequestPost } from "/home/claude/roadmap/functions/api/account/index.js"
import { onRequestPost as __api_feedback_js_onRequestPost } from "/home/claude/roadmap/functions/api/feedback.js"
import { onRequestPost as __api_places_js_onRequestPost } from "/home/claude/roadmap/functions/api/places.js"
import { onRequestGet as __api_routes_index_js_onRequestGet } from "/home/claude/roadmap/functions/api/routes/index.js"
import { onRequestPost as __api_routes_index_js_onRequestPost } from "/home/claude/roadmap/functions/api/routes/index.js"
import { onRequest as ___middleware_js_onRequest } from "/home/claude/roadmap/functions/_middleware.js"

export const routes = [
    {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_logout_js_onRequestPost],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_me_js_onRequestGet],
    },
  {
      routePath: "/api/auth/start",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_start_js_onRequestPost],
    },
  {
      routePath: "/api/auth/verify",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_verify_js_onRequestGet],
    },
  {
      routePath: "/api/routes/:id",
      mountPath: "/api/routes",
      method: "DELETE",
      middlewares: [],
      modules: [__api_routes__id__js_onRequestDelete],
    },
  {
      routePath: "/api/routes/:id",
      mountPath: "/api/routes",
      method: "GET",
      middlewares: [],
      modules: [__api_routes__id__js_onRequestGet],
    },
  {
      routePath: "/api/routes/:id",
      mountPath: "/api/routes",
      method: "PUT",
      middlewares: [],
      modules: [__api_routes__id__js_onRequestPut],
    },
  {
      routePath: "/api/account",
      mountPath: "/api/account",
      method: "DELETE",
      middlewares: [],
      modules: [__api_account_index_js_onRequestDelete],
    },
  {
      routePath: "/api/account",
      mountPath: "/api/account",
      method: "POST",
      middlewares: [],
      modules: [__api_account_index_js_onRequestPost],
    },
  {
      routePath: "/api/feedback",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_feedback_js_onRequestPost],
    },
  {
      routePath: "/api/places",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_places_js_onRequestPost],
    },
  {
      routePath: "/api/routes",
      mountPath: "/api/routes",
      method: "GET",
      middlewares: [],
      modules: [__api_routes_index_js_onRequestGet],
    },
  {
      routePath: "/api/routes",
      mountPath: "/api/routes",
      method: "POST",
      middlewares: [],
      modules: [__api_routes_index_js_onRequestPost],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]