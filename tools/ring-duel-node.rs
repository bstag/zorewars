//! Node-API binding for the same packed engine used by WebAssembly.
use super::{
    advance_group, advance_torus, history_version, run, run_diagnosed, HISTORY_BATCH,
    HISTORY_WORDS, ROUND_STATE_WORDS,
};
use std::convert::TryFrom;
use std::ffi::c_void;
use std::ptr::{null, null_mut};

type Handle = *mut c_void;
type Status = i32;

#[cfg_attr(target_os = "windows", link(name = "node"))]
extern "C" {
    fn napi_get_cb_info(
        env: Handle,
        info: Handle,
        argc: *mut usize,
        argv: *mut Handle,
        this: *mut Handle,
        data: *mut Handle,
    ) -> Status;
    fn napi_get_arraybuffer_info(
        env: Handle,
        value: Handle,
        data: *mut Handle,
        length: *mut usize,
    ) -> Status;
    fn napi_get_typedarray_info(
        env: Handle,
        value: Handle,
        kind: *mut i32,
        length: *mut usize,
        data: *mut Handle,
        buffer: *mut Handle,
        offset: *mut usize,
    ) -> Status;
    fn napi_get_value_uint32(env: Handle, value: Handle, result: *mut u32) -> Status;
    fn napi_create_int32(env: Handle, value: i32, result: *mut Handle) -> Status;
    fn napi_create_function(
        env: Handle,
        name: *const u8,
        length: usize,
        callback: unsafe extern "C" fn(Handle, Handle) -> Handle,
        data: Handle,
        result: *mut Handle,
    ) -> Status;
    fn napi_set_named_property(
        env: Handle,
        object: Handle,
        name: *const u8,
        value: Handle,
    ) -> Status;
    fn napi_throw_range_error(env: Handle, code: *const u8, message: *const u8) -> Status;
}

#[no_mangle]
unsafe extern "C" fn napi_register_module_v1(env: Handle, exports: Handle) -> Handle {
    let mut function = null_mut();
    let mut version = null_mut();
    if napi_create_function(
        env,
        b"dispatch\0".as_ptr(),
        8,
        dispatch,
        null_mut(),
        &mut function,
    ) != 0
        || napi_set_named_property(env, exports, b"dispatch\0".as_ptr(), function) != 0
        || napi_create_int32(env, history_version(), &mut version) != 0
        || napi_set_named_property(env, exports, b"historyVersion\0".as_ptr(), version) != 0
    {
        return null_mut();
    }
    exports
}

unsafe extern "C" fn dispatch(env: Handle, info: Handle) -> Handle {
    if let Some(value) = invoke(env, info) {
        let mut result = null_mut();
        if napi_create_int32(env, value, &mut result) == 0 {
            return result;
        }
    }
    napi_throw_range_error(
        env,
        null(),
        b"Invalid native VM buffers or round state\0".as_ptr(),
    );
    null_mut()
}

unsafe fn invoke(env: Handle, info: Handle) -> Option<i32> {
    let mut argv = [null_mut(); 3];
    let mut argc = argv.len();
    let (mut memory, mut words, mut argument_buffer) = (null_mut(), null_mut(), null_mut());
    let (mut bytes, mut count) = (0, 0);
    let (mut op, mut kind) = (0, 0);
    if napi_get_cb_info(
        env,
        info,
        &mut argc,
        argv.as_mut_ptr(),
        null_mut(),
        null_mut(),
    ) != 0
        || argc != 3
        || napi_get_arraybuffer_info(env, argv[0], &mut memory, &mut bytes) != 0
        || napi_get_value_uint32(env, argv[1], &mut op) != 0
        || napi_get_typedarray_info(
            env,
            argv[2],
            &mut kind,
            &mut count,
            &mut words,
            &mut argument_buffer,
            null_mut(),
        ) != 0
        || kind != 6
        || count < 17
        || memory.is_null()
        || words.is_null()
    {
        return None;
    }
    let mut argument_base = null_mut();
    let mut argument_bytes = 0;
    if napi_get_arraybuffer_info(
        env,
        argument_buffer,
        &mut argument_base,
        &mut argument_bytes,
    ) != 0
        || argument_base.is_null()
        || argument_bytes < 68
    {
        return None;
    }
    let args = std::ptr::read_unaligned(words.cast::<[u32; 17]>());
    let [core, queue, queues, size, max_processes, a, b, c, d, e, f, g, x, y, z, h, i] = args;
    let grouped = op >= 2;
    let (players, ps, ps_size) = match op {
        0 => (2, c, d),
        1 => (2, e, f),
        2 | 3 => (c, a, b),
        _ => return None,
    };
    let width = if op == 3 { 4 } else { 2 };
    if size == 0
        || size
            > if op == 3 && x == 0 {
                i32::MAX as u32
            } else if op == 3 {
                (u64::from(u32::MAX) + 1).div_euclid(6) as u32
            } else {
                65536
            }
        || players == 0
        || max_processes == 0
        || (ps_size > 0 && players >= size && width != 4)
        || (op == 3
            && x != 0
            && (y == 0
                || z == 0
                || u64::from(x) * u64::from(y) > u64::from(size)
                || u64::from(x) * u64::from(y) * u64::from(z) != u64::from(size)))
        || (!grouped && (b >= players || a > 0x80000000))
    {
        return None;
    }
    let mut ranges = [(0usize, 0usize); 8];
    let mut used = 0;
    let mut region = |offset: u32, len: u64, align: usize| -> Option<*mut u8> {
        let start = offset as usize;
        let end = start.checked_add(usize::try_from(len).ok()?)?;
        if end > bytes
            || (memory as usize + start) % align != 0
            || (start != end && ranges[..used].iter().any(|&(a, b)| a < end && start < b))
        {
            return None;
        }
        if start != end {
            ranges[used] = (start, end);
            used += 1;
        }
        Some(memory.cast::<u8>().add(start))
    };
    let core = region(core, u64::from(size) * 3 * width, width as usize)?;
    let queue = region(
        queue,
        u64::from(players) * u64::from(max_processes) * width,
        width as usize,
    )?;
    let queues = region(queues, u64::from(players) * 12, 4)?.cast::<u32>();
    let ps = region(
        ps,
        u64::from(players) * u64::from(ps_size) * width,
        width as usize,
    )?;
    let ps_size = ps_size as usize;
    if grouped {
        let died = region(d, u64::from(players) * 8, 4)?.cast();
        let state_words = ROUND_STATE_WORDS
            + if g == 1 {
                HISTORY_BATCH as usize * HISTORY_WORDS
            } else {
                0
            };
        let state = region(e, (state_words * 4) as u64, 4)?.cast::<u32>();
        if *state.add(1) >= players
            || *state.add(3) > players
            || (*state.add(4) == 0 && *state.add(22) > 0x1fffff)
            || f > i32::MAX as u32
            || g > 1
        {
            return None;
        }
        let (owner_offset, diagnostic_offset) = if op == 3 { (h, i) } else { (x, y) };
        let (owners, diagnostics) = if diagnostic_offset != 0 {
            if players != 2 || g != 0 {
                return None;
            }
            (
                region(owner_offset, u64::from(size), 1)?,
                region(diagnostic_offset, 16, 4)?.cast(),
            )
        } else {
            (null_mut(), null_mut())
        };
        let result = if op == 3 {
            advance_torus(
                core.cast(),
                queue.cast(),
                queues,
                size,
                max_processes,
                ps.cast(),
                ps_size,
                players as usize,
                died,
                state,
                f,
                g,
                x,
                y,
                z,
                owners,
                diagnostics,
            )
        } else {
            advance_group(
                core.cast(),
                queue.cast(),
                queues,
                size,
                max_processes,
                ps.cast(),
                ps_size,
                players as usize,
                died,
                state,
                f,
                g,
                owners,
                diagnostics,
            )
        };
        return if result == i32::MIN as u32 {
            None
        } else {
            Some(result as i32)
        };
    }
    let result = if op == 1 {
        let owners = region(c, u64::from(size), 1)?;
        let diagnostics = region(d, 8, 4)?.cast();
        run_diagnosed(
            core.cast(),
            queue.cast(),
            queues,
            size,
            max_processes,
            a,
            b as usize,
            owners,
            diagnostics,
            ps.cast(),
            ps_size,
        )
    } else {
        run(
            core.cast(),
            queue.cast(),
            queues,
            size,
            max_processes,
            a,
            b as usize,
            ps.cast(),
            ps_size,
        )
    };
    if result == i32::MIN {
        None
    } else {
        Some(result)
    }
}
