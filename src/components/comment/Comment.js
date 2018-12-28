import React, { Component } from 'react';
import { connect } from 'react-redux'
import './Comment.css';
import { setEditorIndex, asyncSetReply } from '../../redux/actions/articleActions';
import moment from 'moment'
import { checkDarkMode, checkDarkModeLinks } from '../../utils/CheckDarkMode.js';
import CustomEditor from '../customEditor/CustomEditor.js';

class Comment extends Component {
  constructor(props) {
    super(props);
    this.state = {
      opened: this.props.opened ? this.props.opened : true,
      child: null
    }
  }

  /**
   * Function to change if the edit box is opened or not. If the reply state is true or false
   */
  reply = () => {
    this.props.changeReplyAndEditor(this.props.commentId, this.props.editorIndex);
  }

  /**
   * Function used to know if a comment is opened or closed.
   * This will also be used to verify if a reply editor is opened and it will close it.
   * It will also close all the child that the comment may have open inside.
   */
  opened = () => {
    this.setState({ 
      opened: !this.state.opened,
      child: this.state.child !== null ? null : this.state.child 
    });
  }

  /**
   * Function that is passed to the editor. The point is to help the user and show where his reply his and change between child replys
   * 
   * This will check if the comment already has an opned child, only one can be open at a time.
   * 
   * If there is no child we add the new clicked child.
   * If the child that is beign clicked is already the child then it is removed.
   * If the child that is beign cliked isn't the child. We first remove the child and then set the new child.
   */
  onChildrenClick = (comment) => {
    if(this.state.child !== null) {
      if(comment.id !== this.state.child.id) 
        this.setState({ child: null }, () => { this.setState({ child: comment }) })
      else 
        this.setState({ child: null })
    } else 
      this.setState({ child: comment })
  }

  /**
   * Function to draw in the header the replys to a comment. This will help to navigate throught the comments.
   */
  setChildren = () => {
    let renderer;
    if(this.props.loading === false) {
      renderer = (
        this.props.comment.children.map((item) => 
          <div className={'childrenContainer commentPointer selectForbiden' 
            + (this.state.child !== null ? (this.state.child.id === item.id ? " hilighlightChild" : "") : "")
            + checkDarkModeLinks(this.props.darkMode, true)} 
            key={item.id} 
            onClick={() => this.onChildrenClick(item)}
          >
            {(item.username !== null ? item.username : 'anon') + item.id}
          </div>
        )
      );
    } else {
      renderer = null;
    }

    return renderer
  }

  /**
   * Function used to draw the header of a comments. Includes open a close button.
   * Includes the usernameId of the poster. The time it was posted. The replys associated with the comment if they exist.
   */
  commentHeader = () => {
    let sign = this.state.opened ? "[-]" : "[+]";
    let username = this.props.comment.username ? this.props.comment.username + this.props.comment.id : "anon" + this.props.comment.id;
    let time = moment(this.props.comment.created_at).format('DD-MM-YYYY | HH:mm');
    let children = this.props.comment.children !== undefined && this.props.comment.children !== null ? true : false;

    return(
      <div className="commentHeader">
        <div onClick={this.opened}>
          {sign}
        </div>
        <div className={'commentPointer commentUsernameContainer' + checkDarkModeLinks(this.props.darkMode, true)} onClick={this.reply}>
          {username}
        </div>
        <div className="answer"> | </div>
        <div className="selectForbiden commentTime">
          {time}
        </div>
        {this.state.opened ? 
          <div className="childrenMainContainer">
           {children ? this.setChildren() : null}
          </div>
          : 
          <div className="childrenContainer">
            {(children ? this.props.comment.children.length : 0 ) + ' respostas'}
          </div>
        }
      </div>
    )
  }

  /**
   * Function to render the reply box
   */
  renderEditor = () => {
    if(this.props.reply && this.state.opened && this.props.editorIndexState) 
      return <CustomEditor commentType={"reply"} commentId={this.props.commentId} closeReplyBox={this.reply} />
    else 
      return null
  }

  /**
   * Function to render the child comment when it is clicked
   */
  renderChildComment = () => {
    if(this.state.child !== null) { 
      return (
        <ConnectedComment comment={this.state.child} commentId={this.state.child.id} opened={this.state.opened} 
          editorIndexState={this.props.editorIndex === this.state.child.id ? true : false } 
        />
      )
    } else 
      return null
  }

  render() {
    let renderer;

    if(!this.state.loading && this.props.currentArticle !== null && this.props.currentArticle !== undefined) {
      renderer = (
        <div id={this.props.comment.id} className={'commentParentContainer' + checkDarkMode(this.props.darkMode, true)}>
          {this.commentHeader()} 
          <div style={{display: this.state.opened ? '' : 'none'}}>
            <div className={"commentContent" + checkDarkMode(this.props.darkMode, true)}>
              {this.props.comment.comment}
            </div>
            {this.renderEditor()}
            <div className="commentFooter">
              <div className={"commentPointer replyButton" + checkDarkMode(this.props.darkMode, true)} onClick={this.reply}>responder</div>
            </div>
          </div>        
          {this.renderChildComment()}
        </div>
      );
    } else 
      renderer = null;
    
    return renderer;
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode,
    currentArticle: state.article.currentArticle,
    loading: state.article.loading,
    editorIndex: state.article.editorIndex,
    reply: state.article.reply
  };
}

function mapDispatchToProps(dispatch) {
  return { 
    changeEditorIndex: (index) => {
      dispatch(setEditorIndex(index));
    },
    changeReplyAndEditor: (commentId, editorIndex) => {
      dispatch(asyncSetReply(commentId, editorIndex))
    }
  };
}

const ConnectedComment = connect(mapStateToProps, mapDispatchToProps)(Comment);
export default ConnectedComment;