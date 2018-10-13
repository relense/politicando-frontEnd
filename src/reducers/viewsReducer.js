import { SET_VIEW } from '../actions/actionTypes';

const initialState = {
    currentView: ""
}

export default function view(state = initialState, action) {
  switch (action.type) {
    case SET_VIEW:
      return Object.assign({}, state, {
        currentView: action.view
      })

    default:
      return state;
  }
}
