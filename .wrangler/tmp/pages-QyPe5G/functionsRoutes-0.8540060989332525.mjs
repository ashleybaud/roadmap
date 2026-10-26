import { onRequestPost as __api_auth_logout_js_onRequestPost } from "/home/claude/roadmap/functions/api/auth/logout.js"
import { onRequestGet as __api_auth_me_js_onRequestGet } from "/home/claude/roadmap/functions/api/auth/me.js"
import { onRequestPost as __api_auth_start_js_onRequestPost } from "/home/claude/roadmap/functions/api/auth/start.js"
import { onRequestGet as __api_auth_verify_js_onRequestGet } from "/home/claude/roadmap/functions/api/auth/verify.js"
import { onRequestGet as __api_routes_public_js_onRequestGet } from "/home/claude/roadmap/functions/api/routes/public.js"
import { onRequestDelete as __api_routes__id__index_js_onRequestDelete } from "/home/claude/roadmap/functions/api/routes/[id]/index.js"
import { onRequestGet as __api_routes__id__index_js_onRequestGet } from "/home/claude/roadmap/functions/api/routes/[id]/index.js"
import { onRequestPut as __api_routes__id__index_js_onRequestPut } from "/home/claude/roadmap/functions/api/routes/[id]/index.js"
import { onRequestDelete as __api_account_index_js_onRequestDelete } from "/home/claude/roadmap/functions/api/account/index.js"
import { onRequestPost as __api_account_index_js_onRequestPost } from "/home/claude/roadmap/functions/api/account/index.js"
import { onRequestPost as __api_feedback_js_onRequestPost } from "/home/claude/roadmap/functions/api/feedback.js"
import { onRequestPost as __api_places_js_onRequestPost } from "/home/claude/roadmap/functions/api/places.js"
import { onRequestGet as __api_ratings_js_onRequestGet } from "/home/claude/roadmap/functions/api/ratings.js"
import { onRequestPost as __api_ratings_js_onRequestPost } from "/home/claude/roadmap/functions/api/ratings.js"
import { onRequestDelete as __api_reports_js_onRequestDelete } from "/home/claude/roadmap/functions/api/reports.js"
import { onRequestGet as __api_reports_js_onRequestGet } from "/home/claude/roadmap/functions/api/reports.js"
import { onRequestPost as __api_reports_js_onRequestPost } from "/home/claude/roadmap/functions/api/reports.js"
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
      routePath: "/api/routes/public",
      mountPath: "/api/routes",
      method: "GET",
      middlewares: [],
      modules: [__api_routes_public_js_onRequestGet],
    },
  {
      routePath: "/api/routes/:id",
      mountPath: "/api/routes/:id",
      method: "DELETE",
      middlewares: [],
      modules: [__api_routes__id__index_js_onRequestDelete],
    },
  {
      routePath: "/api/routes/:id",
      mountPath: "/api/routes/:id",
      method: "GET",
      middlewares: [],
      modules: [__api_routes__id__index_js_onRequestGet],
    },
  {
      routePath: "/api/routes/:id",
      mountPath: "/api/routes/:id",
      method: "PUT",
      middlewares: [],
      modules: [__api_routes__id__index_js_onRequestPut],
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
      routePath: "/api/ratings",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_ratings_js_onRequestGet],
    },
  {
      routePath: "/api/ratings",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ratings_js_onRequestPost],
    },
  {
      routePath: "/api/reports",
      mountPath: "/api",
      method: "DELETE",
      middlewares: [],
      modules: [__api_reports_js_onRequestDelete],
    },
  {
      routePath: "/api/reports",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_reports_js_onRequestGet],
    },
  {
      routePath: "/api/reports",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_reports_js_onRequestPost],
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