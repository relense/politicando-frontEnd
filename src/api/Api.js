export async function post(url, payload) {
    return request(url, payload, "POST")
}

export async function patch(url, payload) {
    return request(url, payload, "PATCH")
}

export async function get(url) {
    return request(url, {}, "GET")
}

async function request(url, payload, method) {
    const response = await doRequest(url, payload, method);
    return response
}

async function doRequest(url, payload, method = 'POST') {
    const request = {
        cache: 'no-cache',
        method: method,
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Methods': '*',
        }
    }

    if (method !== 'GET') request.body = JSON.stringify(payload);

    const responseStream = await fetch(url, request)

    if (responseStream.status === 500) {
        throw new Error ({
          errorCode: 'server_error'
         })
    }

    if (responseStream.status === 401) {
        throw new Error({
          responseStatus: 401,
          errorCodes: 'Could not authenticate'
        })
    }

    if (responseStream.status === 204) {
        return { }
    }

    const resp = await responseStream.json()
    if (resp.hasOwnProperty('data') || responseStream.status === 200) {
        return resp
    }

    throw  new Error ({
        responseStatus: responseStream.status,
        errorCodes: resp.hasOwnProperty('errors') ? resp.errors :  ['unknown']
    })
}

export function buildJsonPayload (type, attributes, id=null) {
    let payload = { data: {} };
    payload.data.type = type;
    payload.data.attributes = attributes;
    if (id) payload.data.id = id;

    return payload;
}
