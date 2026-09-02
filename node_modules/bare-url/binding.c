#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <url.h>
#include <utf.h>
#include <utf/string.h>

// Maximum length, in bytes, of a UTF-8 string that is read into a stack buffer.
// Longer strings fall back to a heap allocation. This covers the vast majority
// of URLs without touching the heap.
#define BARE_URL_STACK_STRING_MAX 1024

// The UTF-8 encoding of a JavaScript string, together with whatever backs it.
typedef struct {
  const utf8_t *data;
  size_t len;

  js_string_view_t *view;
  utf8_t *heap;
} bare_url_string_t;

// Exposes `value` as UTF-8. Strings that are stored as ASCII, which is nearly
// all of them, are borrowed directly from the engine without being copied.
// Anything else is transcoded into `stack`, or into a freshly allocated heap
// buffer when it does not fit. The result must be released with
// bare_url__free_string().
static inline void
bare_url__read_string(js_env_t *env, js_value_t *value, utf8_t *stack, size_t stack_len, bare_url_string_t *result) {
  int err;

  js_string_encoding_t encoding;
  const void *data;
  size_t len;

  err = js_get_string_view(env, value, &encoding, &data, &len, &result->view);
  assert(err == 0);

  result->heap = NULL;

  size_t utf8_len;

  if (encoding == js_utf8) {
    result->data = (const utf8_t *) data;
    result->len = len;

    return;
  }

  if (encoding == js_latin1) {
    utf8_len = utf8_length_from_latin1((const latin1_t *) data, len);

    // A Latin-1 string that is no longer as UTF-8 contains only ASCII, whose
    // Latin-1 and UTF-8 encodings are identical.
    if (utf8_len == len) {
      result->data = (const utf8_t *) data;
      result->len = len;

      return;
    }
  } else {
    assert(encoding == js_utf16le);

    utf8_len = utf8_length_from_utf16le((const utf16_t *) data, len);
  }

  utf8_t *buffer = utf8_len <= stack_len ? stack : (result->heap = malloc(utf8_len));

  if (encoding == js_latin1) {
    latin1_convert_to_utf8((const latin1_t *) data, len, buffer);
  } else {
    utf16le_convert_to_utf8((const utf16_t *) data, len, buffer);
  }

  result->data = buffer;
  result->len = utf8_len;
}

// Releases a string read with bare_url__read_string(), freeing its buffer only
// when it was heap allocated rather than borrowed or written to the caller's
// stack buffer.
static inline void
bare_url__free_string(js_env_t *env, bare_url_string_t *string) {
  int err;

  free(string->heap);

  err = js_release_string_view(env, string->view);
  assert(err == 0);
}

static js_value_t *
bare_url_parse(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bool should_throw;
  err = js_get_value_bool(env, argv[3], &should_throw);
  assert(err == 0);

  bool has_base;
  err = js_is_string(env, argv[1], &has_base);
  assert(err == 0);

  url_t base;
  url_init(&base);

  if (has_base) {
    utf8_t stack[BARE_URL_STACK_STRING_MAX];

    bare_url_string_t input;
    bare_url__read_string(env, argv[1], stack, sizeof(stack), &input);

    err = url_parse(&base, input.data, input.len, NULL);

    bare_url__free_string(env, &input);

    if (err < 0) {
      url_destroy(&base);

      if (should_throw) js_throw_error(env, NULL, "Invalid base URL");

      return NULL;
    }
  }

  utf8_t stack[BARE_URL_STACK_STRING_MAX];

  bare_url_string_t input;
  bare_url__read_string(env, argv[0], stack, sizeof(stack), &input);

  url_t url;
  url_init(&url);

  err = url_parse(&url, input.data, input.len, has_base ? &base : NULL);

  bare_url__free_string(env, &input);

  if (err < 0) {
    url_destroy(&base);
    url_destroy(&url);

    if (should_throw) js_throw_error(env, NULL, "Invalid URL");

    return NULL;
  }

  js_value_t *href;
  err = js_create_string_latin1(env, (const latin1_t *) url.href.data, url.href.len, &href);
  assert(err == 0);

  uint32_t *components;
  err = js_get_typedarray_info(env, argv[2], NULL, (void **) &components, NULL, NULL, NULL);
  assert(err == 0);

  memcpy(components, &url.components, sizeof(url.components));

  url_destroy(&base);
  url_destroy(&url);

  return href;
}

static js_value_t *
bare_url_can_parse(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bool has_base;
  err = js_is_string(env, argv[1], &has_base);
  assert(err == 0);

  url_t base;
  url_init(&base);

  if (has_base) {
    utf8_t stack[BARE_URL_STACK_STRING_MAX];

    bare_url_string_t input;
    bare_url__read_string(env, argv[1], stack, sizeof(stack), &input);

    err = url_parse(&base, input.data, input.len, NULL);

    bare_url__free_string(env, &input);

    if (err < 0) {
      url_destroy(&base);

      js_value_t *result;
      err = js_get_boolean(env, false, &result);
      assert(err == 0);

      return result;
    }
  }

  utf8_t stack[BARE_URL_STACK_STRING_MAX];

  bare_url_string_t input;
  bare_url__read_string(env, argv[0], stack, sizeof(stack), &input);

  url_t url;
  url_init(&url);

  err = url_parse(&url, input.data, input.len, has_base ? &base : NULL);

  bare_url__free_string(env, &input);

  url_destroy(&base);
  url_destroy(&url);

  js_value_t *result;
  err = js_get_boolean(env, err == 0, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_url_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("parse", bare_url_parse)
  V("canParse", bare_url_can_parse)
#undef V

  return exports;
}

BARE_MODULE(bare_url, bare_url_exports)
