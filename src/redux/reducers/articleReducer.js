import { GET_ARTICLE, GET_ARTICLE_COMMENTS, LOADING, SET_COMMENT, SET_EDITOR_INDEX, 
  SET_REPLY, SET_ADDED_COMMENT, REMOVE_ADDED_COMMENT, OPEN_COMMENT } from '../actions/actionTypes';

const initialState = {
  currentArticle: null,
  currentArticleComments: null,
  enters: 0,
  characters: 0,
  max: 300,
  comment: {},
  loading: false,
  editorIndex: null,
  reply: false,
  addedComment: null
}

export default function article(state = initialState, action) {
  switch (action.type) {
    case GET_ARTICLE:
      return {
        ...state,
        currentArticle: action.currentArticle
      }

    case GET_ARTICLE_COMMENTS:
      return {
        ...state,
        currentArticleComments: action.comments
      }

    case SET_COMMENT:
      return {
        ...state,
        comment: action.comment,
        characters: action.characters
      }

    case LOADING:
      return {
        ...state,
        loading: action.loading
      }

    case SET_EDITOR_INDEX:
      return {
        ...state,
        editorIndex: action.editorIndex
      }

    case SET_REPLY:
      return {
        ...state,
        reply: action.reply
      }

    case SET_ADDED_COMMENT:
      return {
        ...state,
        addedComment: action.addedComment
      }

    case REMOVE_ADDED_COMMENT:
      return {
        ...state,
        addedComment: action.addedComment
      }

    case OPEN_COMMENT:
      return {
        ...state,
        currentArticleComments: action.comments
      }

    default:
      return state;
  }
}
