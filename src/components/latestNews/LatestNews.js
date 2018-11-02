import React, { Component } from 'react';
import { connect } from 'react-redux';
import './LatestNews.css';
import LatestNewsSingleContainer from './LatestNewsSingleContainer';

class LatestNews extends Component {
    renderDoubleNewsRow = () => {
        var data = [];

        for(let i = 0; i < this.props.articles.length / 2; i += 2){
            data.push(
                <div key={"doubleContainer" + i} className="latestNewsDoubleContainer">
                    <LatestNewsSingleContainer key={"newsContainer" + i} title={this.props.articles[i].title} content={this.props.articles[i].content} />
                    <LatestNewsSingleContainer key={"newsContainer" + i + 1} title={this.props.articles[i + 1 ].title} content={this.props.articles[i + 1].content} />
                </div>
            )
        }
        return data;
    }

    render() {
        return (
          <div className="latestNewsMainContainer">
            <h3>Latest Information</h3>
            {this.renderDoubleNewsRow()}
          </div>
        );
    }
}

function mapStateToProps(state) {
  return {
      articles: state.articles.all_articles
  };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNews);
