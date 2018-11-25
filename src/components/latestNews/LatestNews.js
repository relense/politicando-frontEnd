import React, { Component } from 'react';
import { connect } from 'react-redux';
import './LatestNews.css';
import LatestNewsSingleContainer from '../latestNewsSingleContainer/LatestNewsSingleContainer';

class LatestNews extends Component {

  renderItem = () => {
    var data = [];

    if (this.props.articles === 0 || this.props.articles === undefined) return;

    for(let i = 0; i < this.props.articles.length; i++){
      data.push(
        <div key={"doubleContainer" + i} className="latestNewsDoubleContainer">
          <LatestNewsSingleContainer key={"newsContainer" + i} article={this.props.articles[i]}/>
        </div>
      )
    }
    return data;
  }

  render() {
    return (
      <div className={this.props.darkMode ? 'latestNewsMainContainer latestNewsMainContainerDarkMode' : 'latestNewsMainContainer'}>
        {this.renderItem()}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNews);
